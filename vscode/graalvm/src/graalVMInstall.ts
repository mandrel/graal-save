/*
 * Copyright (c) 2019, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as cp from 'child_process';
import * as tar from 'tar';
import * as utils from './utils';

const GRAALVM_RELEASES_URL: string = 'https://github.com/oracle/graal/releases';
const LINUX_LINK_REGEXP: RegExp = /<a href="\/oracle\/graal\/releases\/download\/vm-\S*\/graalvm-ce\S*-linux-\S*"/im;
const MAC_LINK_REGEXP: RegExp = /<a href="\/oracle\/graal\/releases\/download\/vm-\S*\/graalvm-ce\S*-(darwin|macos)-\S*"/im;

export async function installGraalVM(storagePath: string | undefined): Promise<void> {
    let downloadedFile;
    try {
        const releaseURL = await getLatestGraalVMRelease();
        downloadedFile = await dowloadGraalVMRelease(releaseURL, storagePath);
        const targetDir = path.dirname(downloadedFile);
        await extractGraalVM(downloadedFile, targetDir);
        fs.unlinkSync(downloadedFile);
        const files = fs.readdirSync(targetDir);
        files.forEach((file) => {
            if (file.startsWith('graalvm') && fs.statSync(path.join(targetDir, file)).isDirectory()) {
                vscode.workspace.getConfiguration('graalvm').update('home', path.join(targetDir, file), true);
                vscode.window.showInformationMessage("GraalVM installed.");
                return;
            }
        });
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}

export async function installGraalVMComponent(componentId: string): Promise<void> {
    const graalVMHome = vscode.workspace.getConfiguration('graalvm').get('home') as string;
    if (!graalVMHome) {
        vscode.window.showErrorMessage("Cannot find GraalVM installation. Please check the 'graalvm.home' setting");
        return;
    }
    try {
        if (!componentId) {
            componentId = await selectAvailableComponent(graalVMHome);
        }
        const executablePath = utils.findExecutable('gu', graalVMHome);
        if (executablePath) {
            let terminal: vscode.Terminal | undefined = vscode.window.activeTerminal;
            if (!terminal) {
                terminal = vscode.window.createTerminal();
            }
            terminal.show();
            terminal.sendText(executablePath + " install " + componentId);
        }
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}

export async function selectInstalledGraalVM(storagePath: string | undefined): Promise<void> {
    const vms: vscode.QuickPickItem[] = [];
    if (storagePath) {
        findGraalVMIn(storagePath, 1, vms);
    }
    if (fs.existsSync('/opt')) {
        findGraalVMIn('/opt', 1, vms);
    }
    if (process.env.GRAALVM_HOME) {
        findGraalVMIn(path.normalize(process.env.GRAALVM_HOME), 0, vms);
    }
    if (process.env.JAVA_HOME) {
        findGraalVMIn(path.normalize(process.env.JAVA_HOME), 0, vms);
    }
    if (process.env.PATH) {
        process.env.PATH.split(':').forEach(p => {
            if (path.basename(p) === 'bin') {
                findGraalVMIn(path.normalize(path.join(p, '..', '..')), 1, vms);
            }
        });
    }
    vms.push({ label: 'Browse...' });
    const selected = await vscode.window.showQuickPick(vms, { matchOnDetail: true, placeHolder: 'Select GraalVM Home' });
    if (selected) {
        let graalVMHome = selected.detail;
        if (!graalVMHome) {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: 'Select'
            };
            const uri = await vscode.window.showOpenDialog(options);
            if (uri && uri.length === 1) {
                graalVMHome = uri[0].fsPath;
            }
        }
        if (graalVMHome) {
            vscode.workspace.getConfiguration('graalvm').update('home', graalVMHome, true);
        }
    }
}

async function getLatestGraalVMRelease(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        https.get(GRAALVM_RELEASES_URL, res => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'] || '';
            let error;
            if (statusCode !== 200) {
                error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
            } else if (!/^text\/html/.test(contentType)) {
                error = new Error(`Invalid content-type.\nExpected text/html but received ${contentType}`);
            }
            if (error) {
                reject(error);
                res.resume();
            } else {
                let rawData: string = '';
                res.on('data', chunk => { rawData += chunk; });
                res.on('end', () => {
                    let match;
                    if (process.platform === 'linux') {
                        match = rawData.match(LINUX_LINK_REGEXP);
                    } else if (process.platform === 'darwin') {
                        match = rawData.match(MAC_LINK_REGEXP);
                    }
                    if (match) {
                        resolve(GRAALVM_RELEASES_URL + match[0].substring(31, match[0].length - 1));
                    } else {
                        reject(new Error(`No GraalVM installable found for platform ${process.platform}`));
                    }
                });
            }
        }).on('error', e => {
            reject(e);
        }).end();
    });
}

async function dowloadGraalVMRelease(releaseURL: string, storagePath: string | undefined): Promise<string> {
    return vscode.window.withProgress<string>({
        location: vscode.ProgressLocation.Notification,
        title: "Downloading GraalVM...",
        cancellable: true
    }, (progress, token) => {
        return new Promise<string>((resolve, reject) => {
            const base: string = path.basename(releaseURL);
            if (storagePath) {
                deleteFolder(storagePath);
                fs.mkdirSync(storagePath);
                const filePath: string = path.join(storagePath, base);
                const file: fs.WriteStream = fs.createWriteStream(filePath);
                const request = function (url: string) {
                    https.get(url, res => {
                        const { statusCode } = res;
                        if (statusCode === 302) {
                            if (res.headers.location) {
                                request(res.headers.location);
                            }
                        } else {
                            let error;
                            const contentType = res.headers['content-type'] || '';
                            const length = parseInt(res.headers['content-length'] || '0');
                            if (statusCode !== 200) {
                                error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
                            } else if (!/^application\/octet-stream/.test(contentType)) {
                                error = new Error(`Invalid content-type.\nExpected text/html but received ${contentType}`);
                            }
                            if (error) {
                                reject(error);
                                res.resume();
                            } else {
                                token.onCancellationRequested(() => {
                                    reject();
                                    res.destroy();
                                    fs.unlinkSync(filePath);
                                });
                                res.pipe(file);
                                if (length) {
                                    const percent = length / 100;
                                    let counter = 0;
                                    let progressCounter = 0;
                                    res.on('data', chunk => {
                                        counter += chunk.length;
                                        let f = Math.floor(counter / percent);
                                        if (f > progressCounter) {
                                            progress.report({ increment: f - progressCounter });
                                            progressCounter = f;
                                        }
                                    });
                                }
                                res.on('end', () => {
                                    resolve(filePath);
                                });
                            }
                        }
                    }).on('error', e => {
                        reject(e);
                    });
                };
                request(releaseURL);
            }
        });
    });
}

function deleteFolder(folder: string) {
    if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach((file, _index) => {
            var curPath: string = path.join(folder, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolder(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folder);
    }
}

function findGraalVMIn(folder: string, depth: number, vms: vscode.QuickPickItem[]) {
    if (!vms.find(vm => vm.detail === folder)) {
        if (fs.existsSync(folder)) {
            const executable: string | undefined = utils.findExecutable('gu', folder);
            if (executable) {
                const out = cp.execFileSync(executable, ['list'], { encoding: 'utf8' });
                if (out) {
                    let header: boolean = true;
                    out.split('\n').forEach(line => {
                        if (header) {
                            if (line.startsWith('-----')) {
                                header = false;
                            }
                        } else {
                            const info: string[] | null = line.match(/\S+/g);
                            if (info && info.length >= 3 && info[0] === 'graalvm') {
                                vms.push({ label: 'GraalVM Version ' + info[1], detail: folder });
                            }
                        }
                    });
                }
            } else if (depth > 0) {
                fs.readdirSync(folder).filter(f => fs.statSync(path.join(folder, f)).isDirectory()).forEach(f => findGraalVMIn(path.join(folder, f), depth - 1, vms));
            }
        }
    }
}

async function extractGraalVM(downloadedFile: string, targetDir: string): Promise<void> {
    return vscode.window.withProgress<void>({
        location: vscode.ProgressLocation.Notification,
        title: "Installing GraalVM..."
    }, (_progress, _token) => {
        return tar.extract({
            cwd: targetDir,
            file: downloadedFile
        });
    });
}

async function selectAvailableComponent(graalVMHome: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const executablePath = utils.findExecutable('gu', graalVMHome);
        if (executablePath) {
            cp.execFile(executablePath, ['available'], async (error, stdout, _stderr) => {
                if (error) {
                    reject(error);
                } else {
                    const components: vscode.QuickPickItem[] = [];
                    let header: boolean = true;
                    stdout.split('\n').forEach(line => {
                        if (header) {
                            if (line.startsWith('-----')) {
                                header = false;
                            }
                        } else {
                            const info: string[] | null = line.match(/\S+/g);
                            if (info && info.length >= 3) {
                                components.push({ label: info[0], detail: info[2] });
                            }
                        }
                    });
                    const selected: vscode.QuickPickItem | undefined = components.length > 0 ? await vscode.window.showQuickPick(components, { placeHolder: 'Select GraalVM component to install' }) : undefined;
                    if (selected) {
                        resolve(selected.label);
                    } else {
                        reject(new Error('No GraalVM component to install.'));
                    }
                }
            });
        } else {
            reject(new Error("Cannot find 'gu' within your GraalVM installation."));
        }
    });
}

/*
 * Copyright (c) 2017, 2019, Oracle and/or its affiliates.
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of
 * conditions and the following disclaimer in the documentation and/or other materials provided
 * with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to
 * endorse or promote products derived from this software without specific prior written
 * permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
 * OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 */
package com.oracle.truffle.llvm.parser.factories;

import java.nio.file.Path;
import java.nio.file.Paths;

import com.oracle.truffle.llvm.runtime.PlatformCapability;
import com.oracle.truffle.llvm.runtime.memory.LLVMSyscallOperationNode;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64Syscall;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallArchPrctlNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallBrkNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallClockGetTimeNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallExitNode;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallFutexNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallGetPpidNode;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallGetcwdNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallGetpidNode;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallGettidNode;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallMmapNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallRtSigactionNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallRtSigprocmaskNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallSetTidAddressNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64SyscallUnameNodeGen;
import com.oracle.truffle.llvm.runtime.nodes.asm.syscall.LLVMAMD64UnknownSyscallNode;

public final class BasicPlatformCapability extends PlatformCapability {

    private static final Path SULONG_LIBDIR = Paths.get("native", "lib");
    public static final String LIBSULONG_FILENAME = "libsulong.bc";
    public static final String LIBSULONGXX_FILENAME = "libsulong++.bc";

    private final boolean loadCxxLibraries;

    public BasicPlatformCapability(boolean loadCxxLibraries) {
        this.loadCxxLibraries = loadCxxLibraries;
    }

    @Override
    public Path getSulongLibrariesPath() {
        return SULONG_LIBDIR;
    }

    @Override
    public String[] getSulongDefaultLibraries() {
        if (loadCxxLibraries) {
            return new String[]{LIBSULONG_FILENAME, LIBSULONGXX_FILENAME};
        } else {
            return new String[]{LIBSULONG_FILENAME};
        }
    }

    @Override
    public LLVMSyscallOperationNode createSyscallNode(long index) {
        try {
            return createSyscallNode(LLVMAMD64Syscall.getSyscall((int) index));
        } catch (IllegalArgumentException e) {
            return new LLVMAMD64UnknownSyscallNode(index);
        }
    }

    private static LLVMSyscallOperationNode createSyscallNode(LLVMAMD64Syscall syscall) {
        switch (syscall) {
            case SYS_mmap:
                return LLVMAMD64SyscallMmapNodeGen.create();
            case SYS_brk:
                return LLVMAMD64SyscallBrkNodeGen.create();
            case SYS_rt_sigaction:
                return LLVMAMD64SyscallRtSigactionNodeGen.create();
            case SYS_rt_sigprocmask:
                return LLVMAMD64SyscallRtSigprocmaskNodeGen.create();
            case SYS_getpid:
                return new LLVMAMD64SyscallGetpidNode();
            case SYS_exit:
            case SYS_exit_group: // TODO: implement difference to SYS_exit
                return new LLVMAMD64SyscallExitNode();
            case SYS_uname:
                return LLVMAMD64SyscallUnameNodeGen.create();
            case SYS_getcwd:
                return LLVMAMD64SyscallGetcwdNodeGen.create();
            case SYS_getppid:
                return new LLVMAMD64SyscallGetPpidNode();
            case SYS_arch_prctl:
                return LLVMAMD64SyscallArchPrctlNodeGen.create();
            case SYS_gettid:
                return new LLVMAMD64SyscallGettidNode();
            case SYS_futex:
                return LLVMAMD64SyscallFutexNodeGen.create();
            case SYS_set_tid_address:
                return LLVMAMD64SyscallSetTidAddressNodeGen.create();
            case SYS_clock_gettime:
                return LLVMAMD64SyscallClockGetTimeNodeGen.create();
            default:
                return new LLVMAMD64UnknownSyscallNode(syscall);
        }
    }
}

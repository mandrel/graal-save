/*
 * Copyright (c) 2013, 2017, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */
package com.oracle.svm.core.posix.headers;

import org.graalvm.nativeimage.c.CContext;
import org.graalvm.nativeimage.c.function.CFunction;
import org.graalvm.nativeimage.c.struct.CField;
import org.graalvm.nativeimage.c.struct.CPointerTo;
import org.graalvm.nativeimage.c.struct.CStruct;
import org.graalvm.nativeimage.c.type.CCharPointer;
import org.graalvm.nativeimage.c.type.CCharPointerPointer;
import org.graalvm.word.PointerBase;
import org.graalvm.word.UnsignedWord;

//Checkstyle: stop

/**
 * Definitions manually translated from the C header file grp.h.
 */
@CContext(PosixDirectives.class)
public class Grp {
    @CStruct(addStructKeyword = true)
    public interface group extends PointerBase {
        @CField
        CCharPointer gr_name();

        @CField
        CCharPointer gr_passwd();

        @CField
        int gr_gid();

        @CField
        CCharPointerPointer gr_mem();
    }

    @CPointerTo(group.class)
    public interface groupPointer extends PointerBase {
        group read();

        void write(PointerBase value);
    }

    @CFunction
    public static native void setgrent();

    @CFunction
    public static native void endgrent();

    @CFunction
    public static native group getgrent();

    @CFunction
    public static native group getgrgid(int gid);

    @CFunction
    public static native group getgrnam(CCharPointer name);

    @CFunction
    public static native int getgrgid_r(int gid, group resultbuf, CCharPointer buffer, UnsignedWord buflen, groupPointer result);

    @CFunction
    public static native int getgrnam_r(CCharPointer name, group resultbuf, CCharPointer buffer, UnsignedWord buflen, groupPointer result);
}

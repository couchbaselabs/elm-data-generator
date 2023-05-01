function OnUpdate(doc, meta) {
    if (!meta.id.match(/^\d{4}-\d{2}-\d{2}-\d+$/)) {
        log("Document id not matching the expected format", meta.id)
    }

    //Extract the date
    const docIdParts = meta.id.split("-");
    const year = docIdParts[0];
    const month = docIdParts[1];

    // Compress document
    let gzipped = gzipSync(encode(doc), {filename: `${meta.id}.csv`}).buffer

    // Upload to S3
    var request = {
        path:`/${year}/${month}/${meta.id}.csv.gz`,
        body: gzipped,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'gzip'
        }
    };
    var response = curl('PUT', s3_bucket, request);
    // Delete the document once successfuly uploaded
    if (response.status == 200) {
        log("Successfully uploaded document", meta.id);
        if (REMOVE) {
            delete src[meta.id]
        }
    } else {
        throw new Error(`Unable to upload document ${meta.id}. Response: ${response}`)
    }


}

/*
=================================================================================
This is a minimal GZIP compression JavaScript extracted from, it is possible
that I missed some routines for edge cases of gzip compression.   I make no
claims of performance and/orcorrectness.

Modified from: https://github.com/101arrowz/fflate/
By: Jon A. Strabala

Oriinal Copyright:

MIT License

Copyright (c) 2020 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
=================================================================================
*/

function encode(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const result = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
    }
    return result;
}

function gzipSync (data, opts) {
    var u8 = Uint8Array, u16 = Uint16Array, u32 = Uint32Array;

    var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
    var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
    var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    var freb = function (eb, start) {
        var b = new u16(31);
        for (var i = 0; i < 31; ++i) {
            b[i] = start += 1 << eb[i - 1];
        }
        var r = new u32(b[30]);
        for (var i = 1; i < 30; ++i) {
            for (var j = b[i]; j < b[i + 1]; ++j) {
                r[j] = ((j - b[i]) << 5) | i;
            }
        }
        return [b, r];
    };
    var _a = freb(fleb, 2), fl = _a[0], revfl = _a[1];
    fl[28] = 258, revfl[258] = 28;
    var _b = freb(fdeb, 0), fd = _b[0], revfd = _b[1];
    var rev = new u16(32768);
    for (var i = 0; i < 32768; ++i) {
        var x = ((i & 0xAAAA) >>> 1) | ((i & 0x5555) << 1);
        x = ((x & 0xCCCC) >>> 2) | ((x & 0x3333) << 2);
        x = ((x & 0xF0F0) >>> 4) | ((x & 0x0F0F) << 4);
        rev[i] = (((x & 0xFF00) >>> 8) | ((x & 0x00FF) << 8)) >>> 1;
    }

    var bInflt = function () { return [u8, u16, u32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gu8]; };
    var bDflt = function () { return [u8, u16, u32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf]; };
    var gze = function () { return [gzh, gzhl, wbytes, crc, crct]; };
    var guze = function () { return [gzs, gzl]; };
    var zle = function () { return [zlh, wbytes, adler]; };
    var zule = function () { return [zlv]; };
    var pbf = function (msg) { return postMessage(msg, [msg.buffer]); };
    var gu8 = function (o) { return o && o.size && new u8(o.size); };
    var cbify = function (dat, opts, fns, init, id, cb) {
        var w = wrkr(fns, init, id, function (err, dat) {
            w.terminate();
            cb(err, dat);
        });
        w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
        return function () { w.terminate(); };
    };
    var astrm = function (strm) {
        strm.ondata = function (dat, final) { return postMessage([dat, final], [dat.buffer]); };
        return function (ev) { return strm.push(ev.data[0], ev.data[1]); };
    };
    var astrmify = function (fns, strm, opts, init, id) {
        var t;
        var w = wrkr(fns, init, id, function (err, dat) {
            if (err)
                w.terminate(), strm.ondata.call(strm, err);
            else {
                if (dat[1])
                    w.terminate();
                strm.ondata.call(strm, err, dat[0], dat[1]);
            }
        });
        w.postMessage(opts);
        strm.push = function (d, f) {
            if (!strm.ondata)
                err(5);
            if (t)
                strm.ondata(err(4, 0, 1), null, !!f);
            w.postMessage([d, t = f], [d.buffer]);
        };
        strm.terminate = function () { w.terminate(); };
    };
    var b2 = function (d, b) { return d[b] | (d[b + 1] << 8); };
    var b4 = function (d, b) { return (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0; };
    var b8 = function (d, b) { return b4(d, b) + (b4(d, b + 4) * 4294967296); };
    var wbytes = function (d, b, v) {
        for (; v; ++b)
            d[b] = v, v >>>= 8;
    };

    var wbytes = function (d, b, v) {
        for (; v; ++b)
            d[b] = v, v >>>= 8;
    };

    var gzh = function (c, o) {
        var fn = o.filename;
        c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
        if (o.mtime != 0)
            wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1000));
        if (fn) {
            c[3] = 8;
            for (var i = 0; i <= fn.length; ++i)
                c[i + 10] = fn.charCodeAt(i);
        }
    };

    var gzs = function (d) {
        if (d[0] != 31 || d[1] != 139 || d[2] != 8)
            err(6, 'invalid gzip data');
        var flg = d[3];
        var st = 10;
        if (flg & 4)
            st += d[10] | (d[11] << 8) + 2;
        for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
            ;
        return st + (flg & 2);
    };

    var gzl = function (d) {
        var l = d.length;
        return ((d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16) | (d[l - 1] << 24)) >>> 0;
    };

    var gzhl = function (o) { return 10 + ((o.filename && (o.filename.length + 1)) || 0); };
    var zlh = function (c, o) {
        var lv = o.level, fl = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
        c[0] = 120, c[1] = (fl << 6) | (fl ? (32 - 2 * fl) : 1);
    };

    var zlv = function (d) {
        if ((d[0] & 15) != 8 || (d[0] >>> 4) > 7 || ((d[0] << 8 | d[1]) % 31))
            err(6, 'invalid zlib data');
        if (d[1] & 32)
            err(6, 'invalid zlib data: preset dictionaries not supported');
    };

    var deo = new u32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
    var et = new u8(0);
    var dflt = function (dat, lvl, plvl, pre, post, lst) {
        var s = dat.length;
        var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
        var w = o.subarray(pre, o.length - post);
        var pos = 0;
        if (!lvl || s < 8) {
            for (var i = 0; i <= s; i += 65535) {
                var e = i + 65535;
                if (e >= s) {
                    w[pos >> 3] = lst;
                }
                pos = wfblk(w, pos + 1, dat.subarray(i, e));
            }
        }
        else {
            var opt = deo[lvl - 1];
            var n = opt >>> 13, c = opt & 8191;
            var msk_1 = (1 << plvl) - 1;
            var prev = new u16(32768), head = new u16(msk_1 + 1);
            var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
            var hsh = function (i) { return (dat[i] ^ (dat[i + 1] << bs1_1) ^ (dat[i + 2] << bs2_1)) & msk_1; };
            var syms = new u32(25000);
            var lf = new u16(288), df = new u16(32);
            var lc_1 = 0, eb = 0, i = 0, li = 0, wi = 0, bs = 0;
            for (; i < s; ++i) {
                var hv = hsh(i);
                var imod = i & 32767, pimod = head[hv];
                prev[imod] = pimod;
                head[hv] = imod;
                if (wi <= i) {
                    var rem = s - i;
                    if ((lc_1 > 7000 || li > 24576) && rem > 423) {
                        pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
                        li = lc_1 = eb = 0, bs = i;
                        for (var j = 0; j < 286; ++j)
                            lf[j] = 0;
                        for (var j = 0; j < 30; ++j)
                            df[j] = 0;
                    }
                    var l = 2, d = 0, ch_1 = c, dif = (imod - pimod) & 32767;
                    if (rem > 2 && hv == hsh(i - dif)) {
                        var maxn = Math.min(n, rem) - 1;
                        var maxd = Math.min(32767, i);
                        var ml = Math.min(258, rem);
                        while (dif <= maxd && --ch_1 && imod != pimod) {
                            if (dat[i + l] == dat[i + l - dif]) {
                                var nl = 0;
                                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                                    ;
                                if (nl > l) {
                                    l = nl, d = dif;
                                    if (nl > maxn)
                                        break;
                                    var mmd = Math.min(dif, nl - 2);
                                    var md = 0;
                                    for (var j = 0; j < mmd; ++j) {
                                        var ti = (i - dif + j + 32768) & 32767;
                                        var pti = prev[ti];
                                        var cd = (ti - pti + 32768) & 32767;
                                        if (cd > md)
                                            md = cd, pimod = ti;
                                    }
                                }
                            }
                            imod = pimod, pimod = prev[imod];
                            dif += (imod - pimod + 32768) & 32767;
                        }
                    }
                    if (d) {
                        syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];
                        var lin = revfl[l] & 31, din = revfd[d] & 31;
                        eb += fleb[lin] + fdeb[din];
                        ++lf[257 + lin];
                        ++df[din];
                        wi = i + l;
                        ++lc_1;
                    }
                    else {
                        syms[li++] = dat[i];
                        ++lf[dat[i]];
                    }
                }
            }
            pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
            if (!lst && pos & 7)
                pos = wfblk(w, pos + 1, et);
        }
        return slc(o, 0, pre + shft(pos) + post);
    };

    var clen = function (cf, cl) {
        var l = 0;
        for (var i = 0; i < cl.length; ++i)
            l += cf[i] * cl[i];
        return l;
    };

    var wfblk = function (out, pos, dat) {
        var s = dat.length;
        var o = shft(pos + 2);
        out[o] = s & 255;
        out[o + 1] = s >>> 8;
        out[o + 2] = out[o] ^ 255;
        out[o + 3] = out[o + 1] ^ 255;
        for (var i = 0; i < s; ++i)
            out[o + i + 4] = dat[i];
        return (o + 4 + s) * 8;
    };

    var wblk = function (dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
        wbits(out, p++, final);
        ++lf[256];
        var _a = hTree(lf, 15), dlt = _a[0], mlb = _a[1];
        var _b = hTree(df, 15), ddt = _b[0], mdb = _b[1];
        var _c = lc(dlt), lclt = _c[0], nlc = _c[1];
        var _d = lc(ddt), lcdt = _d[0], ndc = _d[1];
        var lcfreq = new u16(19);
        for (var i = 0; i < lclt.length; ++i)
            lcfreq[lclt[i] & 31]++;
        for (var i = 0; i < lcdt.length; ++i)
            lcfreq[lcdt[i] & 31]++;
        var _e = hTree(lcfreq, 7), lct = _e[0], mlcb = _e[1];
        var nlcc = 19;
        for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
            ;
        var flen = (bl + 5) << 3;
        var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
        var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + (2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18]);
        if (flen <= ftlen && flen <= dtlen)
            return wfblk(out, p, dat.subarray(bs, bs + bl));
        var lm, ll, dm, dl;
        wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
        if (dtlen < ftlen) {
            lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
            var llm = hMap(lct, mlcb, 0);
            wbits(out, p, nlc - 257);
            wbits(out, p + 5, ndc - 1);
            wbits(out, p + 10, nlcc - 4);
            p += 14;
            for (var i = 0; i < nlcc; ++i)
                wbits(out, p + 3 * i, lct[clim[i]]);
            p += 3 * nlcc;
            var lcts = [lclt, lcdt];
            for (var it = 0; it < 2; ++it) {
                var clct = lcts[it];
                for (var i = 0; i < clct.length; ++i) {
                    var len = clct[i] & 31;
                    wbits(out, p, llm[len]), p += lct[len];
                    if (len > 15)
                        wbits(out, p, (clct[i] >>> 5) & 127), p += clct[i] >>> 12;
                }
            }
        }
        else {
            lm = flm, ll = flt, dm = fdm, dl = fdt;
        }
        for (var i = 0; i < li; ++i) {
            if (syms[i] > 255) {
                var len = (syms[i] >>> 18) & 31;
                wbits16(out, p, lm[len + 257]), p += ll[len + 257];
                if (len > 7)
                    wbits(out, p, (syms[i] >>> 23) & 31), p += fleb[len];
                var dst = syms[i] & 31;
                wbits16(out, p, dm[dst]), p += dl[dst];
                if (dst > 3)
                    wbits16(out, p, (syms[i] >>> 5) & 8191), p += fdeb[dst];
            }
            else {
                wbits16(out, p, lm[syms[i]]), p += ll[syms[i]];
            }
        }
        wbits16(out, p, lm[256]);
        return p + ll[256];
    };

    var wbits = function (d, p, v) {
        v <<= p & 7;
        var o = (p / 8) | 0;
        d[o] |= v;
        d[o + 1] |= v >>> 8;
    };

    var wbits16 = function (d, p, v) {
        v <<= p & 7;
        var o = (p / 8) | 0;
        d[o] |= v;
        d[o + 1] |= v >>> 8;
        d[o + 2] |= v >>> 16;
    };

    var hTree = function (d, mb) {
        var t = [];
        for (var i = 0; i < d.length; ++i) {
            if (d[i])
                t.push({ s: i, f: d[i] });
        }
        var s = t.length;
        var t2 = t.slice();
        if (!s)
            return [et, 0];
        if (s == 1) {
            var v = new u8(t[0].s + 1);
            v[t[0].s] = 1;
            return [v, 1];
        }
        t.sort(function (a, b) { return a.f - b.f; });
        t.push({ s: -1, f: 25001 });
        var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
        t[0] = { s: -1, f: l.f + r.f, l: l, r: r };
        while (i1 != s - 1) {
            l = t[t[i0].f < t[i2].f ? i0++ : i2++];
            r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
            t[i1++] = { s: -1, f: l.f + r.f, l: l, r: r };
        }
        var maxSym = t2[0].s;
        for (var i = 1; i < s; ++i) {
            if (t2[i].s > maxSym)
                maxSym = t2[i].s;
        }
        var tr = new u16(maxSym + 1);
        var mbt = ln(t[i1 - 1], tr, 0);
        if (mbt > mb) {
            var i = 0, dt = 0;
            var lft = mbt - mb, cst = 1 << lft;
            t2.sort(function (a, b) { return tr[b.s] - tr[a.s] || a.f - b.f; });
            for (; i < s; ++i) {
                var i2_1 = t2[i].s;
                if (tr[i2_1] > mb) {
                    dt += cst - (1 << (mbt - tr[i2_1]));
                    tr[i2_1] = mb;
                }
                else
                    break;
            }
            dt >>>= lft;
            while (dt > 0) {
                var i2_2 = t2[i].s;
                if (tr[i2_2] < mb)
                    dt -= 1 << (mb - tr[i2_2]++ - 1);
                else
                    ++i;
            }
            for (; i >= 0 && dt; --i) {
                var i2_3 = t2[i].s;
                if (tr[i2_3] == mb) {
                    --tr[i2_3];
                    ++dt;
                }
            }
            mbt = mb;
        }
        return [new u8(tr), mbt];
    };

    var ln = function (n, l, d) {
        return n.s == -1
            ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1))
            : (l[n.s] = d);
    };

    var lc = function (c) {
        var s = c.length;
        while (s && !c[--s])
            ;
        var cl = new u16(++s);
        var cli = 0, cln = c[0], cls = 1;
        var w = function (v) { cl[cli++] = v; };
        for (var i = 1; i <= s; ++i) {
            if (c[i] == cln && i != s)
                ++cls;
            else {
                if (!cln && cls > 2) {
                    for (; cls > 138; cls -= 138)
                        w(32754);
                    if (cls > 2) {
                        w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);
                        cls = 0;
                    }
                }
                else if (cls > 3) {
                    w(cln), --cls;
                    for (; cls > 6; cls -= 6)
                        w(8304);
                    if (cls > 2)
                        w(((cls - 3) << 5) | 8208), cls = 0;
                }
                while (cls--)
                    w(cln);
                cls = 1;
                cln = c[i];
            }
        }
        return [cl.subarray(0, cli), s];
    };

    var hMap = (function (cd, mb, r) {
        var s = cd.length;
        var i = 0;
        var l = new u16(mb);
        for (; i < s; ++i) {
            if (cd[i])
                ++l[cd[i] - 1];
        }
        var le = new u16(mb);
        for (i = 0; i < mb; ++i) {
            le[i] = (le[i - 1] + l[i - 1]) << 1;
        }
        var co;
        if (r) {
            co = new u16(1 << mb);
            var rvb = 15 - mb;
            for (i = 0; i < s; ++i) {
                if (cd[i]) {
                    var sv = (i << 4) | cd[i];
                    var r_1 = mb - cd[i];
                    var v = le[cd[i] - 1]++ << r_1;
                    for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {
                        co[rev[v] >>> rvb] = sv;
                    }
                }
            }
        }
        else {
            co = new u16(s);
            for (i = 0; i < s; ++i) {
                if (cd[i]) {
                    co[i] = rev[le[cd[i] - 1]++] >>> (15 - cd[i]);
                }
            }
        }
        return co;
    });
    var freb = function (eb, start) {
        var b = new u16(31);
        for (var i = 0; i < 31; ++i) {
            b[i] = start += 1 << eb[i - 1];
        }
        var r = new u32(b[30]);
        for (var i = 1; i < 30; ++i) {
            for (var j = b[i]; j < b[i + 1]; ++j) {
                r[j] = ((j - b[i]) << 5) | i;
            }
        }
        return [b, r];
    };
    var _a = freb(fleb, 2), fl = _a[0], revfl = _a[1];
    fl[28] = 258, revfl[258] = 28;
    var _b = freb(fdeb, 0), fd = _b[0], revfd = _b[1];
    var rev = new u16(32768);
    for (var i = 0; i < 32768; ++i) {
        var x = ((i & 0xAAAA) >>> 1) | ((i & 0x5555) << 1);
        x = ((x & 0xCCCC) >>> 2) | ((x & 0x3333) << 2);
        x = ((x & 0xF0F0) >>> 4) | ((x & 0x0F0F) << 4);
        rev[i] = (((x & 0xFF00) >>> 8) | ((x & 0x00FF) << 8)) >>> 1;
    }
    var flt = new u8(288);
    for (var i = 0; i < 144; ++i)
        flt[i] = 8;
    for (var i = 144; i < 256; ++i)
        flt[i] = 9;
    for (var i = 256; i < 280; ++i)
        flt[i] = 7;
    for (var i = 280; i < 288; ++i)
        flt[i] = 8;
    var fdt = new u8(32);
    for (var i = 0; i < 32; ++i)
        fdt[i] = 5;
    var flm = hMap(flt, 9, 0), flrm = hMap(flt, 9, 1);
    var fdm = hMap(fdt, 5, 0), fdrm = hMap(fdt, 5, 1);
    var max = function (a) {
        var m = a[0];
        for (var i = 1; i < a.length; ++i) {
            if (a[i] > m)
                m = a[i];
        }
        return m;
    };

    var bits = function (d, p, m) {
        var o = (p / 8) | 0;
        return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
    };

    var bits16 = function (d, p) {
        var o = (p / 8) | 0;
        return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
    };

    var shft = function (p) { return ((p + 7) / 8) | 0; };

    var slc = function (v, s, e) {
        if (s == null || s < 0)
            s = 0;
        if (e == null || e > v.length)
            e = v.length;
        var n = new (v.BYTES_PER_ELEMENT == 2 ? u16 : v.BYTES_PER_ELEMENT == 4 ? u32 : u8)(e - s);
        n.set(v.subarray(s, e));
        return n;
    };

    var crct = (function () {
        var t = new Int32Array(256);
        for (var i = 0; i < 256; ++i) {
            var c = i, k = 9;
            while (--k)
                c = ((c & 1) && -306674912) ^ (c >>> 1);
            t[i] = c;
        }
        return t;
    })();

    var crc = function () {
        var c = -1;
        return {
            p: function (d) {
                var cr = c;
                for (var i = 0; i < d.length; ++i)
                    cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);
                c = cr;
            },
            d: function () { return ~c; }
        };
    };

    var dopt = function (dat, opt, pre, post, st) {
        return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : (12 + opt.mem), pre, post, !st);
    };

    const wrapper = {
        gzipSync: function(data, opts) {
            if (!opts)
                opts = {};
            var c = crc(), l = data.length;
            c.p(data);
            var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
            return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
        }
    }
    return wrapper.gzipSync (data, opts);
}

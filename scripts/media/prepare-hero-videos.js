#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_ROOT = path.join(WORKSPACE_ROOT, 'videos');
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'assets', 'generated', 'videos');
const REVISION = 'v3';
const MANIFEST_PATH = path.join(OUTPUT_ROOT, `manifest-${REVISION}.json`);

const JOBS = Object.freeze([
    {
        slug: 'home',
        startSeconds: 0,
        durationSeconds: 16,
        original: 'INICIO WEB 2K.mp4',
        optimized: 'home-hero-optimized.mp4'
    },
    {
        slug: 'la-casona',
        startSeconds: 0,
        durationSeconds: 18,
        original: 'LA CASONA WEB(1).mp4',
        optimized: 'la-casona-hero-optimized.mp4'
    },
    {
        slug: 'las-villas',
        startSeconds: 0,
        durationSeconds: 16,
        original: 'LAS VILLAS WEB 2K.mp4',
        optimized: 'las-villas-hero-optimized.mp4'
    },
    {
        slug: 'entorno',
        startSeconds: 0,
        durationSeconds: 18,
        original: 'ENTORNO WEB 2k.mp4',
        optimized: 'entorno-hero-optimized.mp4'
    },
    {
        slug: 'sobre-nosotros',
        startSeconds: 0,
        durationSeconds: 18,
        original: 'sobre nosotros 2k.mp4',
        optimized: 'sobre-nosotros-hero-optimized.mp4'
    }
]);

const PROFILES = Object.freeze([
    {
        format: 'mp4',
        extension: '.mp4',
        codec: 'libx264',
        maxBytes: 3 * 1024 * 1024,
        codecArgs: [
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '30',
            '-maxrate', '1200k',
            '-bufsize', '2400k',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
        ]
    },
    {
        format: 'webm',
        extension: '.webm',
        codec: 'libvpx-vp9',
        maxBytes: Math.floor(2.5 * 1024 * 1024),
        codecArgs: [
            '-c:v', 'libvpx-vp9',
            '-b:v', '900k',
            '-crf', '40',
            '-maxrate', '1100k',
            '-bufsize', '2200k',
            '-deadline', 'good',
            '-cpu-used', '2',
            '-row-mt', '1'
        ]
    }
]);

const usage = () => `
Prepare poster-first hero video derivatives without touching source media.

Usage:
  node scripts/media/prepare-hero-videos.js --dry-run [options]
  node scripts/media/prepare-hero-videos.js --execute [options]

Options:
  --selection original|optimized  Input family (default: original)
  --only <slug>                   Process one configured hero
  --dry-run                       Print the exact plan; write nothing (default)
  --execute                       Run FFmpeg and create a new manifest
  --help                          Show this help

Outputs are restricted to:
  assets/generated/videos/
`;

function assertInside(root, candidate, label) {
    const relative = path.relative(root, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`${label} sale del directorio permitido: ${candidate}`);
    }
}

function assertNoSymlinkOnExistingPath(candidate) {
    let current = WORKSPACE_ROOT;
    const relative = path.relative(WORKSPACE_ROOT, candidate);
    for (const part of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        if (!fs.existsSync(current)) break;
        if (fs.lstatSync(current).isSymbolicLink()) {
            throw new Error(`No se permite escribir a través de un enlace simbólico: ${current}`);
        }
    }
}

function sha256File(candidate) {
    return crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex');
}

function readOptionValue(argv, index, name) {
    const argument = argv[index];
    const prefix = `${name}=`;
    if (argument.startsWith(prefix)) return { value: argument.slice(prefix.length), nextIndex: index };
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${name}`);
    return { value, nextIndex: index + 1 };
}

function parseArguments(argv) {
    const options = { mode: 'dry-run', selection: 'original', only: null, help: false };
    let explicitMode;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--help') {
            options.help = true;
        } else if (argument === '--dry-run') {
            if (explicitMode && explicitMode !== 'dry-run') throw new Error('No combines --dry-run y --execute');
            explicitMode = 'dry-run';
            options.mode = 'dry-run';
        } else if (argument === '--execute') {
            if (explicitMode && explicitMode !== 'execute') throw new Error('No combines --dry-run y --execute');
            explicitMode = 'execute';
            options.mode = 'execute';
        } else if (argument === '--selection' || argument.startsWith('--selection=')) {
            const parsed = readOptionValue(argv, index, '--selection');
            options.selection = parsed.value;
            index = parsed.nextIndex;
        } else if (argument === '--only' || argument.startsWith('--only=')) {
            const parsed = readOptionValue(argv, index, '--only');
            options.only = parsed.value;
            index = parsed.nextIndex;
        } else {
            throw new Error(`Argumento no reconocido: ${argument}`);
        }
    }

    if (!['original', 'optimized'].includes(options.selection)) {
        throw new Error('--selection debe ser original u optimized');
    }
    if (options.only && !JOBS.some((job) => job.slug === options.only)) {
        throw new Error(`Hero desconocido para --only: ${options.only}`);
    }
    return options;
}

function buildPlan(options) {
    assertInside(WORKSPACE_ROOT, INPUT_ROOT, 'Directorio de entrada');
    assertInside(WORKSPACE_ROOT, OUTPUT_ROOT, 'Directorio de salida');
    assertNoSymlinkOnExistingPath(OUTPUT_ROOT);

    return JOBS
        .filter((job) => !options.only || job.slug === options.only)
        .map((job) => {
            const input = path.resolve(INPUT_ROOT, job[options.selection]);
            assertInside(INPUT_ROOT, input, `Entrada ${job.slug}`);
            if (!fs.existsSync(input) || !fs.statSync(input).isFile()) {
                throw new Error(`No existe la entrada configurada: ${input}`);
            }
            const realInput = fs.realpathSync(input);
            assertInside(INPUT_ROOT, realInput, `Entrada real ${job.slug}`);

            const outputs = PROFILES.map((profile) => {
                const output = path.join(OUTPUT_ROOT, `${job.slug}-hero-${REVISION}${profile.extension}`);
                assertInside(OUTPUT_ROOT, output, `Salida ${job.slug}/${profile.format}`);
                return { ...profile, output };
            });

            return {
                ...job,
                selection: options.selection,
                input: realInput,
                sourceBytes: fs.statSync(realInput).size,
                sourceSha256: sha256File(realInput),
                outputs
            };
        });
}

function ffmpegArguments(item, profile, output) {
    return [
        '-hide_banner',
        '-loglevel', 'warning',
        '-nostdin',
        '-n',
        '-ss', String(item.startSeconds),
        '-i', item.input,
        '-t', String(item.durationSeconds),
        '-map', '0:v:0',
        '-an',
        '-vf', 'scale=960:-2:force_original_aspect_ratio=decrease:flags=lanczos,fps=24',
        ...profile.codecArgs,
        output
    ];
}

function serializablePlan(plan) {
    return {
        mode: 'dry-run',
        outputRoot: path.relative(WORKSPACE_ROOT, OUTPUT_ROOT).replaceAll(path.sep, '/'),
        manifest: path.relative(WORKSPACE_ROOT, MANIFEST_PATH).replaceAll(path.sep, '/'),
        entries: plan.map((item) => ({
            slug: item.slug,
            selection: item.selection,
            source: path.relative(WORKSPACE_ROOT, item.input).replaceAll(path.sep, '/'),
            sourceBytes: item.sourceBytes,
            sourceSha256: item.sourceSha256,
            startSeconds: item.startSeconds,
            durationSeconds: item.durationSeconds,
            outputs: item.outputs.map((profile) => ({
                format: profile.format,
                codec: profile.codec,
                path: path.relative(WORKSPACE_ROOT, profile.output).replaceAll(path.sep, '/'),
                ffmpegArgs: ffmpegArguments(
                    item,
                    profile,
                    path.relative(WORKSPACE_ROOT, profile.output).replaceAll(path.sep, '/')
                )
            }))
        }))
    };
}

function removeCurrentPartial(candidate, token) {
    assertInside(OUTPUT_ROOT, candidate, 'Archivo parcial');
    if (!path.basename(candidate).includes(`.${token}.partial.`)) return;
    if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
}

function executePlan(plan) {
    if (fs.existsSync(MANIFEST_PATH)) {
        throw new Error(`El manifiesto ya existe; no se sobrescribirá: ${MANIFEST_PATH}`);
    }
    plan.flatMap((item) => item.outputs).forEach((profile) => {
        if (fs.existsSync(profile.output)) {
            throw new Error(`La salida ya existe; no se sobrescribirá: ${profile.output}`);
        }
    });

    fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
    assertNoSymlinkOnExistingPath(OUTPUT_ROOT);
    const token = `${process.pid}-${Date.now()}`;
    const generated = [];

    try {
        for (const item of plan) {
            for (const profile of item.outputs) {
                const partial = path.join(
                    OUTPUT_ROOT,
                    `.${path.basename(profile.output, profile.extension)}.${token}.partial${profile.extension}`
                );
                const result = spawnSync('ffmpeg', ffmpegArguments(item, profile, partial), {
                    cwd: WORKSPACE_ROOT,
                    shell: false,
                    stdio: 'inherit',
                    windowsHide: true
                });
                if (result.error) throw result.error;
                if (result.status !== 0) {
                    throw new Error(`FFmpeg falló para ${item.slug}/${profile.format} (${result.status})`);
                }
                if (!fs.existsSync(partial) || fs.statSync(partial).size === 0) {
                    throw new Error(`FFmpeg no produjo una salida válida: ${partial}`);
                }
                if (fs.statSync(partial).size > profile.maxBytes) {
                    throw new Error(`El derivado ${item.slug}/${profile.format} supera el límite de ${profile.maxBytes} bytes`);
                }
                generated.push({ item, profile, partial });
            }
        }

        generated.forEach(({ profile, partial }) => {
            fs.copyFileSync(partial, profile.output, fs.constants.COPYFILE_EXCL);
        });
        generated.forEach(({ partial }) => removeCurrentPartial(partial, token));

        for (const item of plan) {
            if (fs.statSync(item.input).size !== item.sourceBytes || sha256File(item.input) !== item.sourceSha256) {
                throw new Error(`El original cambió durante la codificación: ${item.input}`);
            }
        }

        const manifest = {
            version: 1,
            generatedAt: new Date().toISOString(),
            selection: plan[0]?.selection || 'original',
            entries: plan.map((item) => ({
                slug: item.slug,
                source: path.relative(WORKSPACE_ROOT, item.input).replaceAll(path.sep, '/'),
                sourceBytes: item.sourceBytes,
                sourceSha256: item.sourceSha256,
                startSeconds: item.startSeconds,
                durationSeconds: item.durationSeconds,
                derivatives: item.outputs.map((profile) => ({
                    format: profile.format,
                    codec: profile.codec,
                    path: path.relative(WORKSPACE_ROOT, profile.output).replaceAll(path.sep, '/'),
                    bytes: fs.statSync(profile.output).size
                }))
            }))
        };
        fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
        process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    } catch (error) {
        generated.forEach(({ partial }) => removeCurrentPartial(partial, token));
        throw error;
    }
}

function main(argv = process.argv.slice(2)) {
    try {
        const options = parseArguments(argv);
        if (options.help) {
            process.stdout.write(usage());
            return;
        }
        const plan = buildPlan(options);
        if (options.mode === 'dry-run') {
            process.stdout.write(`${JSON.stringify(serializablePlan(plan), null, 2)}\n`);
            return;
        }
        executePlan(plan);
    } catch (error) {
        process.stderr.write(`Error: ${error.message}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = {
    JOBS,
    INPUT_ROOT,
    OUTPUT_ROOT,
    WORKSPACE_ROOT,
    buildPlan,
    parseArguments
};

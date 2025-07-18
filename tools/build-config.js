var filename = 'daggerheart 二元骰插件.js'

module.exports = {
  dev: {
    // Bundles JavaScript.
    bundle: true,
    // Defines env variables for bundled JavaScript; here `process.env.NODE_ENV`
    // is propagated with a fallback.
    // define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development") },
    // Bundles JavaScript from (see `outfile`).
    entryPoints: ["src/index.ts"],
    // Uses incremental compilation (see `chokidar.on`).
    // incremental: true,
    // Removes whitespace, etc. depending on `NODE_ENV=...`.
    minify: process.env.NODE_ENV === "production",
    // Bundles JavaScript to (see `entryPoints`).
    outfile: "dev/" + filename,
    // Others
    platform: "browser",
    tsconfig: "./tsconfig.json",
    color: true,
    sourcemap: process.env.NODE_ENV === "production" ? false : true,
    external: ['csharp', 'puerts'],
    target: 'es2020',
    treeShaking: true,
    logLevel: 'error',
    charset: 'utf8',
    define: {'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')},
    supported: {
      'async-await': true,
    },
  },
  build: {
    // Bundles JavaScript.
    bundle: true,
    // Defines env variables for bundled JavaScript; here `process.env.NODE_ENV`
    // is propagated with a fallback.
    // define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development") },
    // Bundles JavaScript from (see `outfile`).
    entryPoints: ["src/index.ts"],
    // Uses incremental compilation (see `chokidar.on`).
    // incremental: true,
    // Removes whitespace, etc. depending on `NODE_ENV=...`.
    minify: false,
    // Bundles JavaScript to (see `entryPoints`).
    outfile: "dist/" + filename,
    // Others
    platform: "browser",
    tsconfig: "./tsconfig.json",
    color: true,
    sourcemap: false,
    external: ['csharp', 'puerts'],
    target: 'es6',
    treeShaking: true,
    logLevel: 'error',
    charset: 'utf8',
    define: {'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')},
    supported: {
      'async-await': true,
    },
  }
}

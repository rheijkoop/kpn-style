const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const cheerio = require('cheerio');
const copy = require('copy-template-dir');
const ejs = require('ejs');
const unzipper = require('unzipper');
const svg2ttf = require('svg2ttf');
const ttf2eot = require('ttf2eot');
const ttf2woff = require("ttf2woff");
const ttf2woff2 = require("ttf2woff2");
const SVGIcons2SVGFont = require('svgicons2svgfont');

let UnicodeObj = {};
let startUnicode = 0xe900;

function getIconUnicode(name) {
  let unicode = String.fromCharCode(startUnicode++);
  UnicodeObj[name] = unicode;
  return [unicode];
};

exports.filterSvgFiles = (svgFolderPath) => {
  let files = fs.readdirSync(svgFolderPath, 'utf-8');
  let svgArr = [];

  if (!files) {
    throw new Error(`Error! Svg folder is empty. ${svgFolderPath}`);
  }

  for(let i in files) {
    if (typeof files[i] !== 'string' || path.extname(files[i]) !== '.svg') continue;
    if (!~svgArr.indexOf(files[i])) {
      svgArr.push(path.join(svgFolderPath, files[i]));
    }
  }

  return svgArr;
};

exports.checkSource = async (OPTIONS) => {
  try {
    const source = fs.lstatSync(OPTIONS.src);
    if (source.isFile() && path.extname(OPTIONS.src) === '.zip') {
      log(`${chalk.keyword('orange')('PROGRESS')} Source is a ZIP-file, start unpacking and processing...`);

      const newSourceFolder = OPTIONS.src.replace(/\.[^/.]+$/, '');

      await fs.emptyDir(newSourceFolder);
      await fs.emptyDir(OPTIONS.dist);

      return await fs.createReadStream(OPTIONS.src)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          if (entry.type === 'File' && entry.path.indexOf('/') === -1) {
            let newFileName = entry.path;
            if (OPTIONS.shouldRemoveFromName) {
              const fileNameRegex = new RegExp(OPTIONS.shouldRemoveFromName, 'i');
              newFileName = entry.path.replace(fileNameRegex, '');
            }
            if (OPTIONS.shouldPrefixClassName) {
              newFileName = `${OPTIONS.className}-${newFileName}`;
            }
            entry.pipe(fs.createWriteStream(path.join(newSourceFolder, newFileName)));
          }
          else {
            entry.autodrain();
          }
        })
        .promise()
        .then(
          () => {
            OPTIONS.src = newSourceFolder;
            log(`${chalk.green('SUCCESS')} Source file successfully unpacked and processed: ${chalk.yellow(OPTIONS.src)}\n`, true);
          },
          (e) => {
            log(`${chalk.red('ERROR')} Something went wrong while unzipping source file: ${chalk.yellow(OPTIONS.src)}\n`, true);
          }
        );

    } else {
      // @todo: check this later if this should be renamed
      log(`${chalk.green('SUCCESS')} Source is already a directory: ${chalk.yellow(OPTIONS.src)}\n`, true);
    }
  } catch(error) {
    log(`${chalk.red('ERROR')} Something went wrong while processing source: ${chalk.yellow(OPTIONS.src)}\n`, true);
  }
}

exports.cleanSourceFiles = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start checking on dirty Meta data in icons...`);

  return new Promise((resolve, reject) => {
    this.filterSvgFiles(OPTIONS.src).forEach(svgPath => {
      // const file = fs.readFileSync(svgPath, 'utf8');
      // const svgNode = $(file);

      // symbolNode = $('<symbol></symbol>');
      // symbolNode.attr('viewBox', svgNode.attr('viewBox'));
      // symbolNode.append(svgNode.contents());
      // $('svg').append(symbolNode);
      resolve();
    });

    // fs.writeFile(DIST_PATH, $.html('svg'), (err, data) => {
    //   if (err) {
    //     return reject(err);
    //   }
    //   log(`${chalk.green('SUCCESS')} ${chalk.blueBright('SVG Symbol')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
    //   resolve(data);
    // });
  });
}

exports.createSVG = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('SVG')} font...`);

  UnicodeObj = {};
  return new Promise((resolve, reject) => {
    const fontStream = new SVGIcons2SVGFont({
      ascent: 960,
      descent: -64,
      fontHeight: 1024,
      fontName: OPTIONS.fontName,
      normalize: true
    });

    function writeFontStream(svgPath) {
      let _name = path.basename(svgPath, '.svg');
      const glyph = fs. createReadStream(svgPath);
      glyph.metadata = {
        unicode: getIconUnicode(_name),
        name: _name
      };
      fontStream.write(glyph);
    }

    const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.svg`);

    fontStream.pipe(fs.createWriteStream(DIST_PATH))
      .on('finish', () => {
        log(`${chalk.green('SUCCESS')} ${chalk.blueBright('SVG')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
        resolve(UnicodeObj);
      })
      .on('error', (err) => {
        if (err) {
          log(`${chalk.red('ERROR')} ${chalk.blueBright('SVG')} font not created: ${chalk.yellow(DIST_PATH)}\n`, true);
          reject(err);
        }
      });

    this.filterSvgFiles(OPTIONS.src).forEach(svg => {
      if (typeof svg !== 'string') return false;
      writeFontStream(svg);
    });

    fontStream.end();
  });
};

exports.createTTF = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('TTF')} font...`);

  return new Promise((resolve, reject) => {
    const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.ttf`);
    let ttf = svg2ttf(fs.readFileSync(path.join(OPTIONS.dist, `${OPTIONS.fontName}.svg`), 'utf8'), {});
    ttf = this.ttf = Buffer.from(ttf.buffer);

    fs.writeFile(DIST_PATH, ttf, (err, data) => {
      if (err) {
        return reject(err);
      }
      log(`${chalk.green('SUCCESS')} ${chalk.blueBright('TTF')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
      resolve(data);
    });
  });
};

exports.createEOT = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('EOT')} font...`);

  return new Promise((resolve, reject) => {
    const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.eot`);
    const eot = Buffer.from(ttf2eot(this.ttf).buffer);

    fs.writeFile(DIST_PATH, eot, (err, data) => {
      if (err) {
        return reject(err);
      }
      log(`${chalk.green('SUCCESS')} ${chalk.blueBright('EOT')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
      resolve(data);
    });
  });
};

exports.createWOFF = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('WOFF')} font...`);

  return new Promise((resolve, reject) => {
    const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.woff`);
    const woff = Buffer.from(ttf2woff(this.ttf).buffer);

    fs.writeFile(DIST_PATH, woff, (err, data) => {
      if (err) {
        return reject(err);
      }
      log(`${chalk.green('SUCCESS')} ${chalk.blueBright('WOFF')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
      resolve(data);
    });
  });
};

exports.createWOFF2 = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('WOFF2')} font...`);

  return new Promise((resolve, reject) => {
    const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.woff2`);
    const woff2 = Buffer.from(ttf2woff2(this.ttf).buffer);

    fs.writeFile(DIST_PATH, woff2, (err, data) => {
      if (err) {
        return reject(err);
      }
      log(`${chalk.green('SUCCESS')} ${chalk.blueBright('WOFF2')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
      resolve(data);
    });
  });
};

exports.createSvgSymbol = OPTIONS => {
  log(`${chalk.keyword('orange')('PROGRESS')} Start creating ${chalk.blueBright('SVG Symbol')} font...`);

  const DIST_PATH = path.join(OPTIONS.dist, `${OPTIONS.fontName}.symbol.svg`);
  const $ = cheerio.load('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="display:none;"></svg>');

  return new Promise((resolve, reject) => {
    this.filterSvgFiles(OPTIONS.src).forEach(svgPath => {
      const fileName = path.basename(svgPath, path.extname(svgPath));
      const file = fs.readFileSync(svgPath, 'utf8');
      const svgNode = $(file);

      symbolNode = $('<symbol></symbol>');
      symbolNode.attr('viewBox', svgNode.attr('viewBox'));
      symbolNode.attr('id', `${OPTIONS.clssaNamePrefix}-${fileName}`);
      symbolNode.append(svgNode.contents());
      $('svg').append(symbolNode);
    });

    fs.writeFile(DIST_PATH, $.html('svg'), (err, data) => {
      if (err) {
        return reject(err);
      }
      log(`${chalk.green('SUCCESS')} ${chalk.blueBright('SVG Symbol')} font successfully created: ${chalk.yellow(DIST_PATH)}\n`, true);
      resolve(data);
    });
  });
};

exports.copyTemplate = (inDir, outDir, vars) => {
  return new Promise((resolve, reject) => {
    copy(inDir, outDir, vars, (err, createdFiles) => {
      if (err) {
        reject(err);
      }
      createdFiles.forEach(createdFile => log(`${chalk.green('SUCCESS')} ${chalk.blueBright(path.extname(createdFile).replace(/\./g, '').toUpperCase())} style successfully created: ${chalk.yellow(createdFile)}\n`));
      resolve(createdFiles);
    })
  });
};

exports.createHTML = ({ outPath, data = {}, options = {} }) => {
  return new Promise((resolve, reject) => {
    ejs.renderFile(outPath, data, options, (err, str) => {
      if (err) {
        reject(err);
      }
      resolve(str);
    });
  });
};

var log = exports.log = (string, clearLine = false) => {
  if (process.stdout) {
    if (clearLine) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    }
    process.stdout.write(string);
  } else {
    log(string);
  }
};

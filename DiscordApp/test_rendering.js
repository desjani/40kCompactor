import fs from 'fs';
import { html } from 'satori-html';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { parseGwAppV11 } from '../modules/parsers.js';
import { generateCardHtml } from '../modules/cardRenderer.js';

const fontsDir = './fonts';
const interRegular = fs.readFileSync(fontsDir + '/Inter-Regular.ttf');
const interBold = fs.readFileSync(fontsDir + '/Inter-Bold.ttf');

const listText = fs.readFileSync('../samples/GWAPP-Sample-Tau.txt', 'utf8');
const lines = listText.split(/\r?\n/);
const parsedData = parseGwAppV11(lines, {});

async function run() {
  console.log('Generating card HTML with hideSubunits: true...');
  const cardHtml = generateCardHtml(parsedData, {
    hideSubunits: true,
    wargearShowMode: 'hide-mandatory',
    hidePoints: false
  });

  console.log('Compiling SVG using Satori...');
  const template = html(cardHtml);
  const svg = await satori(template, {
    width: 580,
    fonts: [
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: interBold, weight: 700, style: 'normal' }
    ]
  });

  console.log('Rasterizing PNG using Resvg...');
  const resvg = new Resvg(svg, {
    background: '#18181b',
    fitTo: { mode: 'width', value: 580 }
  });
  const pngData = resvg.render();
  fs.writeFileSync('../samples/test_out_tau.png', pngData.asPng());
  console.log('Successfully generated samples/test_out_tau.png');
}

run().catch(console.error);

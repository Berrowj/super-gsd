'use strict';

const ANSI_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const ANSI_RESET = '\x1b[0m';

function dimension(value, fallback) {
  if (Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

function finiteValues(values) {
  return Array.isArray(values) ? values.filter(Number.isFinite) : [];
}

function resample(values, width) {
  if (width <= 0) {
    return [];
  }
  if (values.length === 1 || width === 1) {
    return Array(width).fill(values[values.length - 1]);
  }

  const lastIndex = values.length - 1;
  const denominator = width - 1;

  return Array.from({ length: width }, (_, index) => {
    const sourceIndex = Math.round((index * lastIndex) / denominator);
    return values[sourceIndex];
  });
}

function bounds(values) {
  let min = values[0];
  let max = values[0];

  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return { min, max };
}

function renderAnsi(values, opts) {
  const options = opts || {};
  const width = dimension(options.width, 16);
  const samples = finiteValues(values);

  if (samples.length === 0) {
    const empty = ' '.repeat(width);
    return options.color ? `${options.color}${empty}${ANSI_RESET}` : empty;
  }

  const points = resample(samples, width);
  const { min, max } = bounds(samples);

  let output;
  if (max === min) {
    output = ANSI_BLOCKS[3].repeat(width);
  } else {
    const range = max - min;
    output = points
      .map((value) => {
        const normalized = (value - min) / range;
        const blockIndex = Math.round(normalized * (ANSI_BLOCKS.length - 1));
        return ANSI_BLOCKS[blockIndex];
      })
      .join('');
  }

  return options.color ? `${options.color}${output}${ANSI_RESET}` : output;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderSvg(values, opts) {
  const options = opts || {};
  const width = dimension(options.width, 110);
  const height = dimension(options.height, 24);
  const color = options.color || 'currentColor';
  const samples = finiteValues(values);
  const svgOpen = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">`;

  if (samples.length === 0) {
    return `${svgOpen}</svg>`;
  }

  const points = resample(samples, Math.max(1, Math.min(width, samples.length)));
  const { min, max } = bounds(samples);
  const maxX = Math.max(0, width - 1);
  const maxY = Math.max(0, height - 1);
  const xDenominator = Math.max(1, points.length - 1);
  const range = max - min;

  const polylinePoints = points
    .map((value, index) => {
      const x = points.length === 1 ? maxX / 2 : (index * maxX) / xDenominator;
      const normalized = range === 0 ? 0.5 : (value - min) / range;
      const y = maxY - normalized * maxY;
      return `${round(x)},${round(y)}`;
    })
    .join(' ');

  return `${svgOpen}<polyline points="${polylinePoints}" stroke="${escapeAttr(color)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  renderAnsi,
  renderSvg,
};

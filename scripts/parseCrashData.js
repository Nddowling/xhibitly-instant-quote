// Parse crash game data from JSON
// Usage: node parseCrashData.js input.json [output.csv]

const fs = require('fs');

function parseCrashData(jsonData) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  const games = data.data?.crashGameList || data.crashGameList || [];

  return games.map(game => ({
    id: game.id,
    startTime: game.startTime,
    crashpoint: game.crashpoint,
    hash: game.hash?.hash || game.hash
  }));
}

function formatAsTable(games) {
  console.log('\n' + '='.repeat(120));
  console.log('Crash Game History'.padStart(65));
  console.log('='.repeat(120));
  console.log(
    'ID'.padEnd(38) +
    'Start Time'.padEnd(32) +
    'Crash Point'.padEnd(15) +
    'Hash (first 20 chars)'
  );
  console.log('-'.repeat(120));

  games.forEach((game, idx) => {
    console.log(
      `${game.id}`.padEnd(38) +
      `${game.startTime}`.padEnd(32) +
      `${game.crashpoint.toFixed(2)}x`.padEnd(15) +
      `${game.hash.substring(0, 20)}...`
    );
  });
  console.log('='.repeat(120) + '\n');
}

function formatAsCSV(games) {
  const header = 'ID,Start Time,Crash Point,Hash\n';
  const rows = games.map(g =>
    `${g.id},"${g.startTime}",${g.crashpoint},${g.hash}`
  ).join('\n');
  return header + rows;
}

function formatAsMarkdown(games) {
  let md = '| # | ID | Start Time | Crash Point | Hash (truncated) |\n';
  md += '|---|---|---|---|---|\n';
  games.forEach((game, idx) => {
    md += `| ${idx + 1} | ${game.id} | ${game.startTime} | ${game.crashpoint.toFixed(2)}x | ${game.hash.substring(0, 20)}... |\n`;
  });
  return md;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node parseCrashData.js <input.json> [output.csv|output.md]');
    console.log('       node parseCrashData.js <input.json> --table');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1];

  try {
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const games = parseCrashData(rawData);

    if (!outputFile || outputFile === '--table') {
      // Print to console as table
      formatAsTable(games);
    } else if (outputFile.endsWith('.csv')) {
      // Save as CSV
      const csv = formatAsCSV(games);
      fs.writeFileSync(outputFile, csv);
      console.log(`✓ Saved ${games.length} games to ${outputFile}`);
    } else if (outputFile.endsWith('.md')) {
      // Save as Markdown
      const md = formatAsMarkdown(games);
      fs.writeFileSync(outputFile, md);
      console.log(`✓ Saved ${games.length} games to ${outputFile}`);
    } else {
      // Save as JSON
      fs.writeFileSync(outputFile, JSON.stringify(games, null, 2));
      console.log(`✓ Saved ${games.length} games to ${outputFile}`);
    }

    console.log(`\nParsed ${games.length} crash games`);
    console.log(`Time range: ${games[games.length-1]?.startTime} to ${games[0]?.startTime}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { parseCrashData, formatAsTable, formatAsCSV, formatAsMarkdown };

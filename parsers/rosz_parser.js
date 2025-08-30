export function parseRosz(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      const data = event.target.result;
      JSZip.loadAsync(data)
        .then(function(zip) {
          const rosterFile = Object.keys(zip.files).find(fileName => fileName.endsWith('.ros'));
          if (rosterFile) {
            return zip.file(rosterFile).async('string');
          } else {
            throw new Error('No .ros file found in the .rosz archive.');
          }
        })
        .then(function(xmlString) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
          const result = parseRosXml(xmlDoc);
          resolve(result);
        })
        .catch(function(error) {
          reject(error);
        });
    };

    reader.onerror = function(event) {
      reject(new Error('File could not be read! Code ' + event.target.error.code));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseRosXml(xmlDoc) {
  const result = { SUMMARY: {}, CHARACTER: [], "OTHER DATASHEETS": [] };

  const roster = xmlDoc.querySelector('roster');
  if (!roster) {
    throw new Error('Invalid Battlescribe file: no roster found.');
  }

  result.SUMMARY.TOTAL_ARMY_POINTS = roster.querySelector('costs > cost[name="pts"]_Total_').getAttribute('value') + 'pts';

  const forces = roster.querySelector('forces');
  const force = forces.querySelector('force');
  result.SUMMARY.FACTION_KEYWORD = force.getAttribute('catalogueName');
  result.SUMMARY.DETACHMENT = force.querySelector('rule[name^="Detachment:"]') ? force.querySelector('rule[name^="Detachment:"]').getAttribute('name').replace('Detachment: ', '') : '';

  const selections = force.querySelector('selections');
  const primarySelections = selections.querySelectorAll(':scope > selection[type="model"], :scope > selection[type="unit"]');

  primarySelections.forEach(selection => {
    const unit = {
      quantity: selection.getAttribute('number') + 'x',
      name: selection.getAttribute('name'),
      points: selection.querySelector('costs > cost[name="pts"]_Total_').getAttribute('value'),
      items: []
    };

    const category = selection.querySelector('category[primary="true"]').getAttribute('name');
    if (category === 'CHARACTERS') {
      result.CHARACTER.push(unit);
    } else {
      result["OTHER DATASHEETS"].push(unit);
    }
  });

  return result;
}
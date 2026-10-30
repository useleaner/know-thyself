import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTree } from './cabala-engine.js';

// Only fictitious observations from the reference app.
// B2=Surname/B3=Mother is benchmark mapping, not observed civil-name order.
// Explicit language selects PT/EN: country labels below document observations, not country inference.
// The 2008/2009 pair supports those dates; exact Jan 1 boundary and K/W/Y remain unverified.
const observations = [
  {
    "id": "observedAlba",
    "countryObserved": "Brazil",
    "profile": {"birthDate": "1991-06-17", "cabala": {"firstNames": "Alba", "paternalSurname": "Costa", "maternalSurname": "Silva", "language": "pt", "order": "paternal-first"}},
    "values": {"kether": "4/3", "binah": "7/4", "chokmah": "3/4", "geburah": "6/4", "chesed": "4/4", "tiphareth": "9/8", "hod": "6/5", "netzach": "6/5", "yesod": "3/4", "malkuth": "2/3"},
    "counts": [1, 2, 0, 1, 1, 3, 3, 2, 1, 1, 1, 0, 1, 1, 0, 3, 1, 1, 1, 2, 0, 1],
    "gifts": [4, 5, 13, 14, 22],
  },
  {
    "id": "observedBento",
    "countryObserved": "Portugal",
    "profile": {"birthDate": "1984-11-23", "cabala": {"firstNames": "Bento", "paternalSurname": "Lima", "maternalSurname": "Pereira", "language": "pt", "order": "paternal-first"}},
    "values": {"kether": "5/3", "binah": "5/4", "chokmah": "7/4", "geburah": "6/4", "chesed": "3/4", "tiphareth": "15/8", "hod": "6/5", "netzach": "3/5", "yesod": "3/4", "malkuth": "3/3"},
    "counts": [0, 3, 1, 2, 2, 3, 1, 1, 0, 0, 3, 1, 1, 1, 2, 1, 1, 0, 0, 2, 1, 2],
    "gifts": [3, 4, 8, 12, 13, 17, 21, 22],
  },
  {
    "id": "observedCompoundFirstnames",
    "countryObserved": "Brazil",
    "profile": {"birthDate": "1991-06-17", "cabala": {"firstNames": "Alba Maria", "paternalSurname": "Costa", "maternalSurname": "Silva", "language": "pt", "order": "paternal-first"}},
    "values": {"kether": "4/3", "binah": "7/4", "chokmah": "1/4", "geburah": "6/4", "chesed": "6/4", "tiphareth": "8/8", "hod": "6/5", "netzach": "6/5", "yesod": "4/4", "malkuth": "2/3"},
    "counts": [2, 2, 0, 2, 1, 3, 2, 3, 1, 2, 1, 0, 2, 1, 1, 2, 2, 1, 1, 2, 0, 2],
    "types": {"1": ["standard", "standard"], "2": ["standard", "primary"], "3": [], "4": ["karma", "karma"], "5": ["short"], "6": ["standard", "standard", "standard"], "7": ["standard", "secondary"], "8": ["standard", "standard", "long"], "9": ["karma"], "10": ["standard", "standard"], "11": ["primary"], "12": [], "13": ["karma", "karma"], "14": ["short"], "15": ["standard"], "16": ["standard", "secondary"], "17": ["standard", "standard"], "18": ["karma"], "19": ["standard"], "20": ["standard", "primary"], "21": [], "22": ["karma", "karma"]},
    "gifts": [],
  },
  {
    "id": "observedYear2008",
    "countryObserved": "Brazil",
    "profile": {"birthDate": "2008-06-17", "cabala": {"firstNames": "Alba", "paternalSurname": "Costa", "maternalSurname": "Silva", "language": "pt", "order": "paternal-first"}},
    "values": {"kether": "4/3", "binah": "10/4", "chokmah": "3/4", "geburah": "4/4", "chesed": "5/4", "tiphareth": "8/8", "hod": "6/5", "netzach": "8/5", "yesod": "4/4", "malkuth": "0/3"},
    "counts": [3, 0, 1, 1, 1, 4, 3, 1, 0, 3, 0, 1, 1, 1, 1, 3, 1, 0, 2, 0, 1, 1],
    "gifts": [5, 8, 14, 17],
  },
  {
    "id": "observedYear2009",
    "countryObserved": "Brazil",
    "profile": {"birthDate": "2009-06-17", "cabala": {"firstNames": "Alba", "paternalSurname": "Costa", "maternalSurname": "Silva", "language": "pt", "order": "paternal-first"}},
    "values": {"kether": "4/3", "binah": "3/4", "chokmah": "4/4", "geburah": "7/4", "chesed": "5/4", "tiphareth": "14/8", "hod": "3/5", "netzach": "7/5", "yesod": "3/4", "malkuth": "4/3"},
    "counts": [1, 3, 0, 2, 1, 1, 2, 2, 2, 1, 3, 0, 2, 1, 1, 1, 2, 2, 1, 2, 0, 1],
    "gifts": [4, 6, 13, 22],
  },
  {
    "id": "observedCountryProbe",
    "countryObserved": "Australia",
    "profile": {"birthDate": "1991-06-17", "cabala": {"firstNames": "Alba", "paternalSurname": "Costa", "maternalSurname": "Silva", "language": "en", "order": "paternal-first"}},
    "values": {"kether": "4/3", "binah": "3/4", "chokmah": "4/4", "geburah": "6/4", "chesed": "5/4", "tiphareth": "13/8", "hod": "4/5", "netzach": "6/5", "yesod": "2/4", "malkuth": "5/3"},
    "gifts": null,
  },
  {
    "id": "observedDario",
    "countryObserved": "Australia",
    "profile": {"birthDate": "1978-08-14", "cabala": {"firstNames": "Dario", "paternalSurname": "Alves", "maternalSurname": "Oliveira", "language": "en", "order": "paternal-first"}},
    "values": {"kether": "5/3", "binah": "6/4", "chokmah": "4/4", "geburah": "6/4", "chesed": "6/4", "tiphareth": "12/8", "hod": "5/5", "netzach": "5/5", "yesod": "4/4", "malkuth": "1/3"},
    "counts": [2, 2, 0, 1, 2, 2, 2, 2, 0, 2, 2, 0, 1, 2, 2, 1, 1, 0, 1, 1, 0, 1],
    "gifts": [1, 4, 5, 10, 13, 14, 19, 22],
  },
];

const normalizeTypes = list => list.map(type => ({ short: 'short-crisis', long: 'long-crisis' })[type] || type).sort();
for (const observation of observations) {
  test(`referência sintética: ${observation.id} (${observation.countryObserved})`, () => {
    const tree = computeTree(observation.profile);
    assert.ok(tree);
    assert.deepEqual(tree.values, observation.values, 'ten observed sphere values');
    const paths = tree.paths.toSorted((a, b) => a.number - b.number);
    if (observation.counts) assert.deepEqual(paths.map(path => path.samples.length), observation.counts, '22 observed multiplicities');
    if (observation.types) {
      for (const path of paths) assert.deepEqual(normalizeTypes(path.samples.map(sample => sample.type)), normalizeTypes(observation.types[path.number]), `observed types on path${path.number}`);
    }
    if (observation.gifts) assert.deepEqual(paths.filter(path => path.gift).map(path => path.number), observation.gifts, 'observed gold markers');
  });
}

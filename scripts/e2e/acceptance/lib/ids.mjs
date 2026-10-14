/**
 * One journey, one id (board D105): `V-J21`, `VJ21` and `V21` are `V21`, since
 * Plans 2, 3, 4, 6 and 7 wrote ids three ways. Anything else, upper-cased.
 */
export const norm = id => String(id).trim().toUpperCase().replace(/^V-?J?(\d\d)$/, 'V$1');

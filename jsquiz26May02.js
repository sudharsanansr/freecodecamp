const x = {};
const y = {key:'y'};
console.log(y.key);
const z = {key:'z'};
console.log(z.key);
x[y] = 123;
x[z] = 456;

console.log(x[y]);
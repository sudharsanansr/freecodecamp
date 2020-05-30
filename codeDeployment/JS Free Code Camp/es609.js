//https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/es6/use-the-rest-parameter-with-function-parameters
//Q:
const sum = (x, y, z) => {
    const args = [x, y, z];
    return args.reduce((a, b) => a + b, 0);
}
  
//A
const sum = (...args) => {
    return args.reduce((a, b) => a + b, 0);
}
  
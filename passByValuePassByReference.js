let a = 5;
let b = a;

console.log(a); // => 5
console.log(b); // => 5

a = 1;

console.log(a); // => 1
console.log(b); // => 5

var hello = function(){
    return "Hello World!";
}

console.log(hello);
console.log(hello());

var hello = () => {
    return "Hello, Good Morning!";
}

console.log(hello);
console.log(hello());
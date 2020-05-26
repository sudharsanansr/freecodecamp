var a = (text) => text;
console.log(a('Hello World!'));

// var citrus = fruits.slice(1, 3);
// console.log(fruits);
// console.log(citrus);

var fruits = ["Banana", "Orange", "Lemon", "Apple", "Mango", "Pineapple", "Custard Apple", "Butter Fruit"];

var batch = (start,end) => {
    return fruits.slice(start,end);
}

var batches = fruits.length / 2;
var startLength = 0;

for(var i = 0; i < batches; i++){
    if(i == 0){
        var max = i + 2;
        var min = max - 2;
        console.log(min,max);
    }
    else{
        min = min + 2;
        max = max + 2;
        console.log(min,max);
    }
}

/*
console.log(batch(0,2));
console.log(batch(2,4));
console.log(batch(4,6));
console.log(batch(6,8));

var batchLen = 2;
var total = fruits.length;
var batches = total / batchLen;
var startLength = 0;
for(var h = 0; h < batches; h++){
    for(var i = startLength; i < startLength+2; i++){
        console.log(i);
    }
    if(h != 0){
        startLength = startLength + 2;
    }
}
*/

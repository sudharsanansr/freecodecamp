function multiplyAll(arr) {
    var product = 1;
    // Only change code below this line
    var sum = 1
    for(var i = 0; i < arr.length; i++){
      sum *= multiplyArray(arr[i]);
    }
    return sum * product;
  }
  
  function multiplyArray(arr){
      var sumArray = 1
      for(var i = 0; i < arr.length; i++){
          //console.log(arr[i]);
          sumArray *= arr[i]
      }
      return sumArray;
  }
  
  multiplyAll([[1,2],[3,4],[5,6,7]]);
  
// Setup
var collection = {
    2548: {
      album: "Slippery When Wet",
      artist: "Bon Jovi",
      tracks: [
        "Let It Rock",
        "You Give Love a Bad Name"
      ]
    },
    2468: {
      album: "1999",
      artist: "Prince",
      tracks: [
        "1999",
        "Little Red Corvette"
      ]
    },
    1245: {
      artist: "Robert Palmer",
      tracks: [ ]
    },
    5439: {
      album: "ABBA Gold"
    }
  };
  
  // Only change code below this line
  function updateRecords(id, prop, value) {
  
    if(prop != 'tracks' && value != ''){
      collection[id]['album'] = value;
    }
  
    if(prop == 'tracks' && !collection[id].hasOwnProperty(prop)){
       collection[id]['tracks'] = [];
    }
  
    if(prop == 'tracks' && collection[id].hasOwnProperty(prop)){
       collection[id]['tracks'].push(value);
    }
  
    if(value == ''){
      delete collection[id][prop];
    }
  
    if(value != '' && !collection[id].hasOwnProperty(prop)){
      collection[id][prop] = value;
    }
  
    return collection;
  }
  
updateRecords(5439, "artist", "ABBA");
  
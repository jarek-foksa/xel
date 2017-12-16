
// @copyright
//   © 2016-2017 Jarosław Foksa

export let readFile = (url) => {
  return new Promise( (resolve, reject) => {
    let xhr = new XMLHttpRequest;
    xhr.open("GET", url)
    xhr.send(null)

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.responseText);
      }
      else {
        reject(xhr.status);
      }
    }

    xhr.onerror = () => {
      reject(xhr.status);
    }
  })
};

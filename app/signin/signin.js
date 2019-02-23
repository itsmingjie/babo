/**
 * Starts the signin process with Firebase Auth
 */

function startLogIn() {
    firebase.auth().signInWithEmailAndPassword(document.getElementById("email").value, document.getElementById("password").value).then(function () {
        window.location.href = "/app/"
    }).catch(function (error) {
        var errorCode = error.code;
        var errorMessage = error.message;

        console.log(errorCode + ": " + errorMessage)
    });
}

document.getElementById("login-button").addEventListener('click', startLogIn);
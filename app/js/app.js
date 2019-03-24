const db = firebase.firestore();
var user = null;
const source = document.getElementById("boba-template").innerHTML;
const bobaTemp = Handlebars.compile(source);

// configure timezone
Date.prototype.toDateInputValue = function() {
  var local = new Date(this);
  local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
  return local.toJSON().slice(0, 10);
};

// PWA Helper
function addToHomeScreen() {
  let a2hsBtn = document.querySelector(".ad2hs-prompt"); // hide our user interface that shows our A2HS button
  a2hsBtn.style.display = "none"; // Show the prompt
  deferredPrompt.prompt(); // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then(function(choiceResult) {
    if (choiceResult.outcome === "accepted") {
      console.log("User accepted the A2HS prompt");
    } else {
      console.log("User dismissed the A2HS prompt");
    }
    deferredPrompt = null;
  });
}
function showAddToHomeScreen() {
  let a2hsBtn = document.querySelector(".ad2hs-prompt");
  a2hsBtn.style.display = "block";
  a2hsBtn.addEventListener("click", addToHomeScreen);
}
let deferredPrompt;
window.addEventListener("beforeinstallprompt", function(e) {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  showAddToHomeScreen();
});

const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};
// Detects if device is in standalone mode
const isInStandaloneMode = () =>
  "standalone" in window.navigator && window.navigator.standalone;

// Checks if should display install popup notification:
if (isIos() && !isInStandaloneMode()) {
  showIosInstall();
}

function showIosInstall() {
  let iosPrompt = document.querySelector(".ios-prompt");
  iosPrompt.style.display = "block";
  iosPrompt.addEventListener("click", () => {
    iosPrompt.style.display = "none";
  });
}

function loggedInActions(dn) {
  user = firebase.auth().currentUser;

  document.getElementById("cust-greeting").innerHTML =
    " You're " +
    MANTRA[Math.floor(Math.random() * MANTRA.length)] +
    ", " +
    dn +
    ".";
  document.getElementById("dow").innerHTML =
    "Today is " + moment().format("MMMM Do, YYYY") + ".";
  getSum();
  loadLogs();
  document.body.classList.remove("hidden");

  db.collection("users")
    .doc(user.uid)
    .update({
      displayName: dn
    })
    .catch(function(error) {
      console.error("Error updating display name in DB: ", error);
    });
}

function startLogOut() {
  firebase
    .auth()
    .signOut()
    .then(function() {
      window.location.reload();
    })
    .catch(function(error) {
      // An error happened.
    });
}

function loadLogs() {
  var userRef = db.collection("users").doc(user.uid);

  userRef
    .collection("bobas")
    .get()
    .then(function(querySnapshot) {
      if (querySnapshot.size != 0) {
        document.getElementById("is-empty").style.display = "none";
        // choo choo ... all aboard!
        userRef
          .collection("bobas")
          //.where("timestamp", ">=", startOfWeek())
          .limit(10)
          .orderBy("timestamp", "desc")
          .get()
          .then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
              var d = doc.data();

              insertLog({
                bid: doc.id,
                timestamp: moment
                  .unix(d.timestamp.seconds)
                  .format("h:mm:ss A, MMMM Do, YYYY"),
                price: parseFloat(d.price).toFixed(2),
                vendor: d.vendor,
                size: d.size,
                flavor: d.flavor
              });
            });
          })
          .catch(function(error) {
            console.log("Error getting documents: ", error);
          });
      }
    });
}

// validate fields and call newBoba
function validateFields() {
  var ids = ["vendor", "price", "flavor", "size", "time"];
  var error = document.getElementById("error-msg");

  for (i = 0; i < ids.length; i++) {
    if (document.getElementById("new-" + ids[i]).value == "") {
      error.innerHTML = "Missing field: " + ids[i];
      error.classList.remove("is-hidden");
      return false;
    }
  }

  var dt = document.getElementById("new-time").value;
  if (new Date(dt) > new Date()) {
    error.innerHTML = "You can't buy stuff from the future :)";
    error.classList.remove("is-hidden");
    return false;
  }

  //Passed!
  newBoba();
}

// create a new boba, called by the submission button of the new modal
function newBoba() {
  var boba = {
    vendor: document.getElementById("new-vendor").value,
    price: document.getElementById("new-price").value,
    flavor: document.getElementById("new-flavor").value,
    size: document.getElementById("new-size").value,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  var userRef = db.collection("users").doc(user.uid);
  var time = document.getElementById("new-time").value;

  if (time != null && time != "") {
    boba.timestamp = new Date(time);
  }

  // add log to collection
  userRef
    .collection("bobas")
    .add(boba)
    .then(function(r) {
      boba.bid = r.id;

      boba.timestamp = moment().format("h:mm:ss A, MMMM Do, YYYY");
      document.getElementById("is-empty").style.display = "none";
      insertLog(boba);
      // add to running total (%totalPrice%)
      db.runTransaction(function(transaction) {
        // This code may get re-run multiple times if there are conflicts.
        return transaction.get(userRef).then(function(d) {
          if (!d.exists) {
            throw "User does not exist! Something is wrong.";
          }

          var newSum = parseFloat(d.data().totalPrice) + parseFloat(boba.price);

          transaction.update(userRef, {
            totalPrice: newSum
          });
        });
      })
        .then(function() {
          document.getElementById("new-lead").classList.toggle("is-active");
          wipe();
          swal(
            "Nice!",
            "This cup of boba is now documented. Looking forward to the next one!",
            "success"
          );
          getSum();
        })
        .catch(function(error) {
          console.log("Transaction failed: ", error);
        });
    })
    .catch(function(error) {
      console.error("Error writing document: ", error);
    });
}

// Displays the total amount of money spent as part of the greeting
function getSum() {
  var userRef = db.collection("users").doc(user.uid);

  userRef.get().then(function(d) {
    // promise limitation
    if (
      d.exists &&
      d.data().totalPrice != undefined &&
      d.data().totalPrice != 0
    ) {
      document.getElementById("totalPrice").innerHTML =
        "$" + d.data().totalPrice;
      document.getElementById("digest").innerHTML =
        "You've spent a total of $" +
        d.data().totalPrice +
        " on boba. Get some more!";
    } else {
      document.getElementById("totalPrice").innerHTML = "$0";
      document.getElementById("digest").innerHTML =
        "You've spent a total of $0. Time to get some boba!";
    }
  });
}

// wipe all values of the "new" form
function wipe() {
  var container, inputs, index;

  container = document.getElementById("new-lead");
  inputs = container.getElementsByTagName("input");
  for (index = 0; index < inputs.length; ++index) {
    inputs[index].value = "";
  }
}

// from boba data inserted (including boba id!) create and display a new entry
function insertLog(boba) {
  var o = document.getElementById("boba-container").innerHTML;
  document.getElementById("boba-container").innerHTML = bobaTemp(boba) + o;
}

// remove a purchase log from the database
function deleteLog(bid) {
  var userRef = db.collection("users").doc(user.uid);
  var bidRef = db
    .collection("users")
    .doc(user.uid)
    .collection("bobas")
    .doc(bid);

  bidRef
    .get()
    .then(function(b) {
      console.log(b.data().price);
      bidRef.delete().then(function() {
        // remove from running total (%totalPrice%)
        db.runTransaction(function(transaction) {
          // This code may get re-run multiple times if there are conflicts.
          return transaction.get(userRef).then(function(d) {
            if (!d.exists) {
              throw "User does not exist! Something is wrong.";
            }

            var newSum =
              parseFloat(d.data().totalPrice) - parseFloat(b.data().price);

            transaction.update(userRef, {
              totalPrice: newSum
            });

            if (newSum == 0)
              document.getElementById("is-empty").style.display = "block";
          });
        }).then(function() {
          document.getElementById("bobalog-" + bid).style.display = "none";
          getSum();
          swal(
            "Done!",
            "That purchase has been removed from the entirety of history.",
            "success"
          );
        });
      });
    })
    .catch(function(error) {
      swal(
        "Error",
        "Something went wrong, please try again. Message: " + error,
        "error"
      );
    });
}

document.getElementById("logout").addEventListener("click", startLogOut);
document.getElementById("new-lead-button").addEventListener("click", () => {
  document.getElementById("new-lead").classList.toggle("is-active");
  document.getElementById("addBoba").addEventListener("click", validateFields);
});
document.querySelectorAll(".close-modal").forEach(el => {
  el.addEventListener("click", e => {
    e.preventDefault();
    e.target.closest(".modal").classList.toggle("is-active");
  });
});

const db = firebase.firestore();
var user = null;
const source = document.getElementById("boba-template").innerHTML;
const bobaTemp = Handlebars.compile(source);

function loggedInActions(dn) {
    user = firebase.auth().currentUser;

    document.getElementById("cust-greeting").innerHTML = " You're " + MANTRA[Math.floor(Math.random() * MANTRA.length)] + ", " + dn + ".";
    document.getElementById("dow").innerHTML = "Today is " + moment().format('MMMM Do, YYYY') + ".";
    getSum();
    loadLogs();
    document.body.classList.remove("hidden");

    db.collection("users").doc(user.uid).update({
        displayName: dn
    }).catch(function (error) {
        console.error("Error updating display name in DB: ", error);
    });
}

function startLogOut() {
    firebase.auth().signOut().then(function () {
        window.location.reload();
    }).catch(function (error) {
        // An error happened.
    });
}

function loadLogs() {
    var userRef = db.collection("users").doc(user.uid);

    userRef.collection("bobas").get().then(function (querySnapshot) {
        if (querySnapshot.size != 0) {
            document.getElementById("is-empty").style.display = "none";
            // choo choo ... all aboard!
            userRef.collection("bobas")
                //.where("timestamp", ">=", startOfWeek())
                .limit(10)
                .orderBy("timestamp", "desc")
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        var d = doc.data();

                        insertLog({
                            bid: doc.id,
                            timestamp: moment.unix(d.timestamp.seconds).format("h:mm:ss A, MMMM Do, YYYY"),
                            price: d.price,
                            vendor: d.vendor,
                            size: d.size,
                            flavor: d.flavor
                        })
                    });
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        }
    });


}

// create a new boba, called by the submission button of the new modal
function newBoba() {
    var boba = {
        vendor: document.getElementById("new-vendor").value,
        price: document.getElementById("new-price").value,
        flavor: document.getElementById("new-flavor").value,
        size: document.getElementById("new-size").value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }

    var userRef = db.collection("users").doc(user.uid);

    // add log to collection
    userRef.collection("bobas").add(boba)
        .then(function (r) {
            boba.bid = r.id;

            boba.timestamp = moment().format("h:mm:ss A, MMMM Do, YYYY");
            document.getElementById("is-empty").style.display = "none";
            insertLog(boba);
            // add to running total (%totalPrice%)
            db.runTransaction(function (transaction) {
                // This code may get re-run multiple times if there are conflicts.
                return transaction.get(userRef).then(function (d) {
                    if (!d.exists) {
                        throw "User does not exist! Something is wrong."
                    }

                    var newSum = parseFloat(d.data().totalPrice) + parseFloat(boba.price);

                    transaction.update(userRef, {
                        totalPrice: newSum
                    });
                });
            }).then(function () {
                document.getElementById("new-lead").classList.toggle("is-active");
                wipe();
                swal(
                    'Nice!',
                    'This cup of boba is now documented. Looking forward to the next one!',
                    'success'
                );
                getSum();
            }).catch(function (error) {
                console.log("Transaction failed: ", error);
            });
        })
        .catch(function (error) {
            console.error("Error writing document: ", error);
        });
}

// Displays the total amount of money spent as part of the greeting
function getSum() {
    var userRef = db.collection("users").doc(user.uid);

    userRef.get().then(function (d) {
        // promise limitation
        if (d.exists && d.data().totalPrice != undefined && d.data().totalPrice != 0) {
            document.getElementById("digest").innerHTML = "You've spent a total of $" + d.data().totalPrice + " on boba. Get some more!";
        } else {
            document.getElementById("digest").innerHTML = "You've spent a total of $0. Time to get some boba!";
        }
    })
}

// wipe all values of the "new" form
function wipe() {
    var container, inputs, index;

    container = document.getElementById("new-lead");
    inputs = container.getElementsByTagName('input');
    for (index = 0; index < inputs.length; ++index) {
        inputs[index].value = '';
    }
}

// from boba data inserted (including boba id!) create and display a new entry
function insertLog(boba) {
    var o = document.getElementById("boba-container").innerHTML;
    document.getElementById("boba-container").innerHTML = bobaTemp(boba) + o;

    VanillaTilt.init(document.querySelector("#bobalog-" + boba.bid), {
        gyroscope: true,
        glare: false,
        max: 5,
        scale: 1.05,
        reset: true
    });
}

// remove a purchase log from the database
function deleteLog(bid) {

    var userRef = db.collection("users").doc(user.uid);
    var bidRef = db.collection("users").doc(user.uid).collection("bobas").doc(bid);

    bidRef.get().then(function (b) {
        console.log(b.data().price)
        bidRef.delete().then(function () {
            // remove from running total (%totalPrice%)
            db.runTransaction(function (transaction) {
                // This code may get re-run multiple times if there are conflicts.
                return transaction.get(userRef).then(function (d) {
                    if (!d.exists) {
                        throw "User does not exist! Something is wrong."
                    }

                    var newSum = parseFloat(d.data().totalPrice) - parseFloat(b.data().price);

                    transaction.update(userRef, {
                        totalPrice: newSum
                    });

                    if (newSum == 0)
                        document.getElementById("is-empty").style.display = "block";
                });
            }).then(function () {
                document.getElementById("bobalog-" + bid).style.display = "none";
                getSum();
                swal(
                    'Done!',
                    'That purchase has been removed from the entirety of history.',
                    'success'
                )
            })
        })
    }).catch(function (error) {
        swal(
            'Error',
            'Something went wrong, please try again. Message: ' + error,
            'error'
        )
    })

}

document.getElementById("logout").addEventListener('click', startLogOut);
document.getElementById("new-lead-button").addEventListener('click', () => {
    document.getElementById("new-lead").classList.toggle("is-active");
    document.getElementById("addBoba").addEventListener('click', newBoba);
});
document.querySelectorAll(".close-modal").forEach((el) => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        e.target.closest('.modal').classList.toggle("is-active");
    })
});
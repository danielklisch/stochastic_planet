document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
document.addEventListener('wheel', wheelHandler, false);

var rightPressed = false;
var leftPressed = false;
var upPressed = false;
var downPressed = false;
var scrollAmount = 0.0;

var distance = 5.0
var pos_x = 0.0
var pos_y = 0.0

function keyDownHandler(event) {
    if(event.keyCode == 39) {
        rightPressed = true;
    }
    else if(event.keyCode == 37) {
        leftPressed = true;
    }
    if(event.keyCode == 40) {
    	downPressed = true;
    }
    else if(event.keyCode == 38) {
    	upPressed = true;
    }
}

function keyUpHandler(event) {
    if(event.keyCode == 39) {
        rightPressed = false;
    }
    else if(event.keyCode == 37) {
        leftPressed = false;
    }
    if(event.keyCode == 40) {
    	downPressed = false;
    }
    else if(event.keyCode == 38) {
    	upPressed = false;
    }
}

function wheelHandler(event) {
    scrollAmount += event.deltaY;
}

var minDistance = 1.0;

function handleInput(time,deltaTime) {
    distance += scrollAmount*(distance-minDistance)*2*deltaTime;
    if (distance<minDistance+0.02) distance = minDistance+0.02;
    scrollAmount = 0;
    if (rightPressed) {
        pos_x -= deltaTime*(distance-minDistance);
    }
    if (leftPressed) {
        pos_x += deltaTime*(distance-minDistance);
    }
    if (upPressed) {
        pos_y += deltaTime*(distance-minDistance);
        if (pos_y>1.5) pos_y = 1.5;
    }
    if (downPressed) {
        pos_y -= deltaTime*(distance-minDistance);
        if (pos_y<-1.5) pos_y = -1.5;
    }    
}

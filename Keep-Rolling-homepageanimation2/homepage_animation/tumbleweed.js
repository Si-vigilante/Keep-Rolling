(function() {
    const ball = document.getElementById('tumbleweed');
    if (!ball) return;

    const normalSpeed = 2;       
    const friction = 0.97;       
    const bounceFactor = -0.9;   
    
   
    const ballWidth = 120;
    const ballHeight = 120;

    let x = window.innerWidth / 2 - ballWidth / 2;
    let y = window.innerHeight / 2 - ballHeight / 2;
    let vx = (Math.random() - 0.5) * normalSpeed;
    let vy = (Math.random() - 0.5) * normalSpeed;
    let rotation = 0;
    let isBoosted = false;       

    let maxX = window.innerWidth - ballWidth;
    let maxY = window.innerHeight - ballHeight;

    window.addEventListener('resize', () => {
        maxX = window.innerWidth - ballWidth;
        maxY = window.innerHeight - ballHeight;
    });

    function update() {
        let speed = Math.sqrt(vx * vx + vy * vy);

        if (!isBoosted) {
            vx += (Math.random() - 0.5) * 0.5
            vy += (Math.random() - 0.5) * 0.5;
            speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > 0) {
                vx = (vx / speed) * normalSpeed;
                vy = (vy / speed) * normalSpeed;
            }
        } else {
            vx *= friction;
            vy *= friction;
            speed = Math.sqrt(vx * vx + vy * vy);
            if (speed <= normalSpeed) {
                isBoosted = false;
            }
        }

        x += vx;
        y += vy;
        rotation += vx * 1.5; 

        if (x < 0) {
            x = 0;
            vx = vx * bounceFactor;
        } else if (x > maxX) {
            x = maxX;
            vx = vx * bounceFactor;
        }

        if (y < 0) {
            y = 0;
            vy = vy * bounceFactor;
        } else if (y > maxY) {
            y = maxY;
            vy = vy * bounceFactor;
        }

        ball.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
        requestAnimationFrame(update);
    }

    ball.addEventListener('click', () => {
        const angle = Math.random() * Math.PI * 2;
        const boostSpeed = 20 + Math.random() * 10; 
        vx = Math.cos(angle) * boostSpeed;
        vy = Math.sin(angle) * boostSpeed;
        isBoosted = true;
    });

    requestAnimationFrame(update);
})();
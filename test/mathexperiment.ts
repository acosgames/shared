function run() {

    let n = 100;
    let ratio = 0;
    let diff = 0;
    for (let i = 1; i <= n; i++) {
        ratio = 1 / i;

        console.log(`ratio [${i}] ${isPrime(i)}:`, ratio);


    }
    for (let i = 1; i <= n; i++) {
        if (i > 1) {
            diff = ((1 / (i - 1)) - (1 / i))
            // diff = diff + (Math.E * (i / 2));
            console.log(`diff [${i}] ${isPrime(i)}:`, diff);
        }
    }
}

const isPrime = num => {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) return 0;
    }
    return num > 1 ? 1 : 0;
}

run();
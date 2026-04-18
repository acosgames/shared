// const ranks = [
//     'Class ',
//     'Drummer',
//     'Gunner',
//     'Ranger',
//     'Sapper',
//     'Lance Corporal',
//     'Corporal',
//     'Sergeant',
//     'Staff Sergeant',
//     'Warrant Officer Class 1',
//     'Warrant Officer Class 2',
//     'Officer Cadet',
//     'Second Lieutenant',
//     'Lieutenant',
//     'Captain',
//     'Major',
//     'Lieutenant Colonel',
//     'Colonel',
//     'Brigadier',
//     'Major General',
//     'Lieutenant General',
//     'General',
//     'Field Marshal',
//     'King',
// ]

const ranks = [
    // 'Class Y',
    'X',
    'W',
    'V',
    'U',
    'T',
    'S',
    'R',
    'Q',
    'P',
    'O',
    'N',
    'M',
    'L',
    'K',
    'J',
    'I',
    'H',
    'G',
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
    'Ω'
]

const RatingConfig = {

    muDefault: () => { return 25.0 },
    sigmaDefault: () => { return 1.33 },

    clampMu: (mu) => {
        return Math.min(60, Math.max(-10, mu))
    },
    clampSigma: (sigma) => {
        return Math.min(10, Math.max(0, sigma))
    },
    muRating: (mu) => {
        //mu should only be between -10 and 60
        let muRating = (mu + 10);
        //rating will be between 0 - 7000
        muRating = Math.min(70, Math.max(0, muRating));
        return muRating * 100;
    },

    ranks: () => { return ranks },

    ratingToRankNumber: (rating) => {
        const maxRating = 7000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt) + 1;
        return rt;
    },

    ratingToRank: (rating) => {
        const maxRating = 7000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt);
        return ranks[rt];

    }
}

export default RatingConfig;
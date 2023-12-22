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

module.exports = RatingText = {

    ranks: () => { return ranks },

    ratingToRankNumber: (rating) => {
        const maxRating = 5000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt) + 1;
        return rt;
    },

    ratingToRank: (rating) => {
        const maxRating = 5000;
        let rt = Math.min(maxRating, Math.max(0, rating));
        rt = rt / maxRating;
        rt = rt * (ranks.length - 1);

        rt = Math.round(rt);
        return ranks[rt];

    }
}
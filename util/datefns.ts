
import moment from 'moment';
const utcToLocal = (date) => {

};

const utcDATETIME = (date) => {
    date = date || new Date();
    return moment(date).utc().format('YYYY-MM-DD HH:mm:ss');

    // let utc = date.toISOString();
    // return format(date.toISOString(), 'YYYY-MM-DD HH:mm:ss')
};

export { utcToLocal, utcDATETIME };
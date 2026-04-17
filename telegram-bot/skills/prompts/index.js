const housekeepingPrompt = require('./housekeeping');
const teknikPrompt = require('./teknik');
const fbPrompt = require('./fb');
const spaPrompt = require('./spa');
const getReceptionPrompt = require('./reception');

/**
 * Belirlenen departmana göre ilgili AI promptunu döndürür.
 * 
 * @param {string} department - 'HOUSEKEEPING', 'TEKNIK', 'F&B', 'SPA', 'RESEPSIYON' vb.
 * @param {object} locationData - Sistemden çekilen { url, description } nesnesi
 * @param {object} agencyData - Sistemden çekilen { hotelReservationLink, agencies: [] } nesnesi
 * @returns {string} İlgili AI sistem promptu
 */
function getPromptForDepartment(department, locationData = null, agencyData = null) {
    switch (department) {
        case 'HOUSEKEEPING':
            return housekeepingPrompt;
        case 'TEKNIK':
            return teknikPrompt;
        case 'F&B':
            return fbPrompt;
        case 'SPA':
            return spaPrompt;
        case 'RESEPSIYON':
        case 'GUEST_RELATIONS':
        default:
            return getReceptionPrompt(locationData, agencyData);
    }
}

module.exports = {
    getPromptForDepartment
};

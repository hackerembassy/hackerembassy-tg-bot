const { writeToBuffer } = require('@fast-csv/format');
const FundsRepository = require("../repositories/fundsRepository");

async function exportFundToCSV(fundname){
    let fundDonations = FundsRepository.getDonationsForName(fundname)
    ?.map((d=>{
      return {
        username: d.username,
        donation: d.value,
        currency: d.currency
      }
    }));

    return csv = await writeToBuffer(fundDonations, {headers:true});
}

module.exports = {exportFundToCSV};
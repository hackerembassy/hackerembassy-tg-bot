function anyItemIsInList(items, list) {
    return items.some(item => list.includes(item))
}

module.exports = { anyItemIsInList };
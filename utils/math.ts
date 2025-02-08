export function cosineSimilarity(vectorA: number[], vectorB: number[]) {
    let dotProduct = 0;
    let sumA = 0;
    let sumB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];
        sumA += vectorA[i] * vectorA[i];
        sumB += vectorB[i] * vectorB[i];
    }

    return dotProduct / (Math.sqrt(sumA) * Math.sqrt(sumB));
}

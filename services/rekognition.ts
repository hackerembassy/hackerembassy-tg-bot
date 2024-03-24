import {
    ListCollectionsCommand,
    RekognitionClient,
    RekognitionClientConfig,
    SearchUsersByImageCommand,
} from "@aws-sdk/client-rekognition";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
const REGION = "eu-west-2";

// Create an Amazon Transcribe service client object.
const rekognitionClient = new RekognitionClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
} as RekognitionClientConfig);

export function ListCollections() {
    return rekognitionClient.send(new ListCollectionsCommand({}));
}

export function SearchUsersByImage(bucket: string, key: string) {
    const command = new SearchUsersByImageCommand({
        CollectionId: "nick-faces",
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key,
            },
        },
    });

    return rekognitionClient.send(command);
}

export function PutObject(file: Buffer, bucket: string, key: string) {
    const s3Client = new S3Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
    });

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
    });

    return s3Client.send(command);
}

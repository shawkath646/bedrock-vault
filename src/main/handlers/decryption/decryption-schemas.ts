import z from 'zod';

export const FileKeyEntrySchema = z.object({
    name: z.string(),
    encName: z.string(),
    virtualPath: z.string(),
    key: z.instanceof(Buffer),
    iv: z.instanceof(Buffer),
    enc_algorithm: z.string(),
    size: z.number(),
    ext: z.string(),
    thumbnail: z.string()
});

export const MetadataSchema = z.object({
    chunkName: z.string(),
    fileMetadata: z.array(FileKeyEntrySchema)
});

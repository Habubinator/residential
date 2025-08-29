import bcrypt from "bcrypt";
import stringHash from "string-hash";
import uuid from "uuid-random";
import rn from "random-number";
import randomstring from "randomstring";

export const generateSaltFromString = async (
    value: string,
    stringNum: number
): Promise<string> => {
    const saltStartHash = await bcrypt.genSalt();
    const saltStart = saltStartHash.substring(0, 7);

    let saltEnd = "";
    saltEnd = saltEnd.padEnd(stringNum, stringHash(value).toString());
    saltEnd = saltEnd.substring(0, stringNum);

    return saltStart + saltEnd;
};

export const generatePasswordSalt = (value: string) =>
    generateSaltFromString(value, 22);

export const generateBcryptHash = (value: string, salt: string): string => {
    return bcrypt.hashSync(value, salt);
};

export const compareBcryptHash = (value: string, hash: string): boolean => {
    return bcrypt.compareSync(value, hash);
};

export const randomUUID = () => uuid();

const options = {
    min: 10000,
    max: 99999,
    integer: true,
};

export const randomNumberCode = () => rn(options);

export const generateRandomPassword = () => randomstring.generate(12);

export const generateRandomFileHash = () => randomstring.generate(3);

export const generateLoginFromEmail = (email: string) =>
    email.replace(/[^A-z\d]/g, "").toLowerCase();

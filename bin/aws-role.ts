#!/usr/bin/env node

import * as AWS from "aws-sdk";
import * as os from "os";
import * as cp from "child_process";
import * as yargs from "yargs";
import * as fs from "fs-extra";
import * as path from "path";

let home: string;

if (process.platform === "linux") {
    home = process.env.HOME || ".";
} else if (process.platform === "win32") {
    home = process.env.USERPROFILE ||
        (process.env.HOMEPATH ? ((process.env.HOMEDRIVE || "C:\\") + process.env.HOMEPATH) : "C:\\");
} else {
    throw new Error(`${process.platform} is not supported`);
}

const CONFIG_FILE = path.join(home, ".aws-role", "config");

const commandOptionAlias = {
    alias: "a",
    demand: true,
    requiresArg: true,
    describe: "the alias of role",
    type: "string",
} as yargs.Options;

const commandOptionRole = {
    alias: "r",
    demand: true,
    requiresArg: true,
    describe: "the arn of role",
    type: "string",
} as yargs.Options;

const commandOptionMfa = {
    alias: "m",
    demand: true,
    requiresArg: true,
    describe: "the arn of mfa",
    type: "string",
} as yargs.Options;

const commandOptionDuration = {
    alias: "d",
    default: 3600,
    demand: true,
    requiresArg: true,
    describe: "the arn of mfa",
    type: "number",
} as yargs.Options;

const commandOptionCode = {
    alias: "c",
    demand: true,
    requiresArg: true,
    describe: "the mfa code",
    type: "string",
} as yargs.Options;

const commandAdd = {
    builder: (builder: yargs.Argv) => {
        return builder.options(
            {
                alias: commandOptionAlias,
                role: commandOptionRole,
                mfa: commandOptionMfa,
                duration: commandOptionDuration,
            }
        )
    },
    command: "add",
    description: "Add an aws role configuration",
    handler: (args: yargs.Arguments) => {
        return addConfiguration(
            args.alias,
            args.role,
            args.mfa,
            args.duration
        );
    }
} as yargs.CommandModule;

const commandAssume = {
    builder: (builder: yargs.Argv) => {
        return builder.options(
            {
                alias: commandOptionAlias,
                code: commandOptionCode,
            }
        )
    },
    command: "assume",
    description: "Assume an aws role",
    handler: (args: yargs.Arguments) => {
        return assumeAwsRole(
            args.alias,
            args.code
        );
    }
} as yargs.CommandModule;

const commandDelete = {
    builder: (builder: yargs.Argv) => {
        return builder.options(
            {
                alias: commandOptionAlias,
            }
        )
    },
    command: "delete",
    description: "Delete an aws role configuration",
    handler: (args: yargs.Arguments) => {
        return deleteConfiguration(args.alias);
    }
} as yargs.CommandModule;

const commandList = {
    command: "list",
    description: "List the role configuration",
    handler: (args: yargs.Arguments) => {
        console.log(`Configured roles:\n${JSON.stringify(readConfiguration(), null, 2)}`);
    }
} as yargs.CommandModule;

yargs
    .command(commandAdd)
    .command(commandAssume)
    .command(commandDelete)
    .command(commandList)
    .strict()
    .help()
    .argv;

interface RoleConfiguration {
    role: string;
    mfa: string;
    duration: number;
}

function readConfiguration(): any {
    const config = fs.readJsonSync(CONFIG_FILE, {throws: false});
    return config ? config : {};
}

function addConfiguration(alias: string, role: string, mfa: string, duration: number): void {
    const config = readConfiguration();
    config[alias] = {
        role,
        mfa,
        duration,
    } as RoleConfiguration;

    fs.outputJsonSync(CONFIG_FILE, config, {spaces: 2});
}

function deleteConfiguration(alias: string): void {
    const config = readConfiguration();
    delete config[alias];

    fs.outputJsonSync(CONFIG_FILE, config, {spaces: 2});
}

function assumeAwsRole(alias: string, code: string): void {
    const roleConfig: RoleConfiguration = readConfiguration()[alias];
    if (roleConfig === undefined) {
        throw new Error(`Couldn't find role configuration for ${alias}`);
    }

    const username: string = os.userInfo().username;
    new AWS.STS().assumeRole({
        DurationSeconds: roleConfig.duration,
        RoleArn: roleConfig.role,
        RoleSessionName: `aws-role-${username}`,
        SerialNumber: roleConfig.mfa,
        TokenCode: code,
    }, (err: AWS.AWSError, data: AWS.STS.Types.AssumeRoleResponse) => {
        if (err) {
            throw new Error(`Operation failed: ${err.message}`);
        }

        if (data.Credentials === undefined) {
            throw new Error("Credentials not found");
        }

        if (process.env === undefined) {
            throw new Error("Env not found");
        }
        const awsEnv = process.env;
        awsEnv.AWS_ACCESS_KEY_ID = data.Credentials.AccessKeyId;
        awsEnv.AWS_SECRET_ACCESS_KEY = data.Credentials.SecretAccessKey;
        awsEnv.AWS_SESSION_TOKEN = data.Credentials.SessionToken;
        awsEnv.AWS_SECURITY_TOKEN = data.Credentials.SessionToken;
        awsEnv.PROMPT = `(aws-role ${alias}) > `;

        let command;
        if (process.platform === "linux") {
            command = "bash";
        } else {
            command = "cmd";
        }
        const child = cp.spawn(command, [], {
            env: awsEnv,
            stdio: "inherit"
        });

        child.on('close', (code) => {
            console.log("Bye");
            process.exit(code);
        });
    });
}

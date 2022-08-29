type ProcessEnvValue = string | undefined

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            AUTH_KEY: ProcessEnvValue
            AUTH_EMAIL: ProcessEnvValue
            COMMAND_TASK: ProcessEnvValue
            COMPLETED_ACTION: ProcessEnvValue
            COMPLETED_WEBHOOK_URL: ProcessEnvValue
            CONCURRENT_EXES: ProcessEnvValue
            DUMMY_UPLOAD_ROUTE: ProcessEnvValue
            EXPLORER_DIR: ProcessEnvValue
            MANIFEST_ID: ProcessEnvValue
            MAX_PACKAGE_SIZE: ProcessEnvValue
            METADATA_UPLOAD_ROUTE: ProcessEnvValue
            PACKAGE_COMPRESSION_LEVEL: ProcessEnvValue
            PACKAGE_DIR: ProcessEnvValue
            PACKAGES_PER_EXE: ProcessEnvValue
            RL_VERSION: ProcessEnvValue
        }
    }
}

export {}
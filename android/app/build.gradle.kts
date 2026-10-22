plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.countryalert.unrest"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.countryalert.unrest"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // Release signing key. GitHub Actions decodes it from the repository's
    // ANDROID_KEYSTORE_BASE64 secret and passes its location here. Without it
    // (forks, local builds) the APK is signed with a temporary debug key.
    val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storeType = "PKCS12"
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = "cityunrest"
                keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (keystorePath != null) "release" else "debug")
        }
    }

    // The shared data file (unrest words, news editions, city names) at the repo root.
    sourceSets["main"].resources.srcDirs("../../data")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    // Real org.json for unit tests (Android's copy is a stub off-device).
    testImplementation("org.json:json:20240303")
}

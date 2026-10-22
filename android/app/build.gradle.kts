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

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with a temporary debug key that changes on every build, so
            // uninstall the old version before installing a new one.
            signingConfig = signingConfigs.getByName("debug")
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

// Compile check for the Android app without the Android SDK: builds the app's
// Kotlin code against Robolectric's copy of the Android framework (from Maven
// Central) and runs the unit tests. The real app is built from ../ (see README).
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories { mavenCentral() }
}
rootProject.name = "jvm-check"

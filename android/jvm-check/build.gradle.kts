plugins {
    kotlin("jvm") version "2.0.21"
}

val stubDir = layout.buildDirectory.dir("generated/stubR")

val generateR by tasks.registering(Exec::class) {
    inputs.dir("../app/src/main/res")
    outputs.dir(stubDir)
    commandLine("python3", "gen_r.py", stubDir.get().file("R.kt").asFile.path)
}

sourceSets {
    main {
        kotlin.srcDirs("../app/src/main/java", stubDir)
        resources.srcDirs("../../data")
    }
    test { kotlin.srcDirs("../app/src/test/java") }
}

tasks.named("compileKotlin") { dependsOn(generateR) }



dependencies {
    compileOnly("org.robolectric:android-all:15-robolectric-12714715")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

tasks.test {
    workingDir = projectDir
    testLogging { events("passed", "failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}

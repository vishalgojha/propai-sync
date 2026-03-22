pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
  resolutionStrategy {
    eachPlugin {
      if (requested.id.id.startsWith("org.jetbrains.kotlin.")) {
        useVersion("2.2.21")
      }
    }
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "PropAiSyncAndroid"
include(":app")
include(":benchmark")

val mlc4jDir = file("dist/lib/mlc4j")
if (mlc4jDir.isDirectory) {
  include(":mlc4j")
  project(":mlc4j").projectDir = mlc4jDir
}


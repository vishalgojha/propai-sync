plugins {
  id("com.android.application") version "9.0.1" apply false
  id("com.android.test") version "9.0.1" apply false
  id("org.jlleitschuh.gradle.ktlint") version "14.0.1" apply false
  id("org.jetbrains.kotlin.plugin.compose") version "2.2.21" apply false
  id("org.jetbrains.kotlin.plugin.serialization") version "2.2.21" apply false
}

val mlcPackageConfigFile = layout.projectDirectory.file("mlc-package-config.json")
val mlcDistDir = layout.projectDirectory.dir("dist")
val mlcWindowsPackageScript = layout.projectDirectory.file("scripts/run-mlc-package.ps1")
val mlcPython = providers.gradleProperty("androidassistant.mlc.python").orElse("python")
val mlcLlmSourceDir =
  providers.gradleProperty("androidassistant.mlc.sourceDir")
    .orElse(providers.environmentVariable("MLC_LLM_SOURCE_DIR"))
val mlcJitPolicy =
  providers.gradleProperty("androidassistant.mlc.jitPolicy")
    .orElse(providers.environmentVariable("MLC_JIT_POLICY"))
val mlcPythonPath =
  providers.gradleProperty("androidassistant.mlc.pythonPath")
    .orElse(providers.environmentVariable("PYTHONPATH"))
val mlcLibraryPath =
  providers.gradleProperty("androidassistant.mlc.libraryPath")
    .orElse(providers.environmentVariable("MLC_LIBRARY_PATH"))
val mlcAdditionalPath =
  providers.gradleProperty("androidassistant.mlc.path")
    .orElse(providers.environmentVariable("ANDROID_ASSISTANT_MLC_PATH"))
val mlcJavaHome =
  providers.gradleProperty("androidassistant.mlc.javaHome")
    .orElse(providers.environmentVariable("JAVA_HOME"))
val mlcAndroidNdk =
  providers.gradleProperty("androidassistant.mlc.androidNdk")
    .orElse(providers.environmentVariable("ANDROID_NDK"))
val mlcTvmNdkCc =
  providers.gradleProperty("androidassistant.mlc.tvmNdkCc")
    .orElse(providers.environmentVariable("TVM_NDK_CC"))
val isWindows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)

tasks.register<Delete>("cleanMlcDist") {
  group = "mlc"
  description = "Delete generated MLC packaging output."
  delete(mlcDistDir)
}

tasks.register<Exec>("packageMlcAndroid") {
  group = "mlc"
  description = "Run `mlc_llm package` using ./mlc-package-config.json."
  workingDir = rootDir
  inputs.file(mlcPackageConfigFile)
  outputs.dir(mlcDistDir)

  doFirst {
    if (!mlcPackageConfigFile.asFile.exists()) {
      error("Missing ${mlcPackageConfigFile.asFile}.")
    }

    val resolvedSourceDir = mlcLlmSourceDir.orNull?.trim().orEmpty()
    if (resolvedSourceDir.isEmpty()) {
      error(
        "Missing MLC_LLM_SOURCE_DIR. Set the environment variable or pass " +
          "-Pandroidassistant.mlc.sourceDir=/absolute/path/to/mlc-llm.",
      )
    }

    if (isWindows) {
      if (!mlcWindowsPackageScript.asFile.exists()) {
        error("Missing ${mlcWindowsPackageScript.asFile}.")
      }

      val windowsArgs =
        mutableListOf(
          "powershell",
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          mlcWindowsPackageScript.asFile.absolutePath,
          "-PythonExecutable",
          mlcPython.get(),
          "-MlcLlmSourceDir",
          resolvedSourceDir,
          "-PackageConfigPath",
          mlcPackageConfigFile.asFile.absolutePath,
          "-OutputDir",
          mlcDistDir.asFile.absolutePath,
        )

      mlcPythonPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-PythonPath", value)
      }
      mlcLibraryPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-MlcLibraryPath", value)
      }
      mlcJavaHome.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-JavaHome", value)
      }
      mlcAndroidNdk.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-AndroidNdk", value)
      }
      mlcTvmNdkCc.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-TvmNdkCc", value)
      }
      mlcAdditionalPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-AdditionalPath", value)
      }
      mlcJitPolicy.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        windowsArgs += listOf("-MlcJitPolicy", value)
      }

      commandLine(windowsArgs)
    } else {
      environment("MLC_LLM_SOURCE_DIR", resolvedSourceDir)
      mlcJitPolicy.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("MLC_JIT_POLICY", value)
      }

      mlcPythonPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("PYTHONPATH", value)
      }
      mlcLibraryPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("MLC_LIBRARY_PATH", value)
      }
      mlcJavaHome.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("JAVA_HOME", value)
      }
      mlcAndroidNdk.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("ANDROID_NDK", value)
      }
      mlcTvmNdkCc.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        environment("TVM_NDK_CC", value)
      }
      mlcAdditionalPath.orNull?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
        val mergedPath =
          buildList {
            addAll(value.split(java.io.File.pathSeparatorChar).filter { it.isNotBlank() })
            System.getenv("PATH")?.takeIf { it.isNotBlank() }?.let(::add)
          }.joinToString(separator = java.io.File.pathSeparator)
        environment("PATH", mergedPath)
      }

      commandLine(
        mlcPython.get(),
        "-m",
        "mlc_llm",
        "package",
        "--package-config",
        mlcPackageConfigFile.asFile.absolutePath,
        "--output",
        mlcDistDir.asFile.absolutePath,
      )
    }
  }
}

tasks.register("normalizeMlcAndroidDist") {
  group = "mlc"
  description = "Normalize generated mlc4j Gradle metadata for this repo's Android/Kotlin toolchain."
  dependsOn("packageMlcAndroid")

  doLast {
    val mlc4jBuildFile = layout.projectDirectory.file("dist/lib/mlc4j/build.gradle").asFile
    if (!mlc4jBuildFile.exists()) {
      error("Missing generated mlc4j build file at $mlc4jBuildFile.")
    }

    val original = mlc4jBuildFile.readText()
    var normalized =
      original
        .replace(Regex("""(?m)^\s*id 'org\.jetbrains\.kotlin\.android'\s*\r?\n"""), "")
        .replace(Regex("""(?ms)^\s*kotlinOptions\s*\{.*?^\s*\}\s*\r?\n"""), "")
        .replace(
          Regex("""id 'org\.jetbrains\.kotlin\.plugin\.serialization'( version '[^']+')?"""),
          "id 'org.jetbrains.kotlin.plugin.serialization'",
        )

    if (!normalized.contains("buildToolsVersion '36.1.0'")) {
      normalized =
        normalized.replace(
          Regex("""compileSdk \d+"""),
          "$0\n    buildToolsVersion '36.1.0'",
        )
    }

    if (normalized != original) {
      mlc4jBuildFile.writeText(normalized)
    }
  }
}

tasks.register("sanitizeMlcBundleMetadata") {
  group = "mlc"
  description = "Remove VCS metadata from bundled model assets before APK packaging."
  dependsOn("packageMlcAndroid")

  doLast {
    val bundleDir = layout.projectDirectory.dir("dist/bundle").asFile
    if (!bundleDir.exists()) return@doLast

    bundleDir
      .walkTopDown()
      .filter { candidate ->
        candidate.isDirectory && candidate.name == ".git" ||
          candidate.isFile && candidate.name == ".gitattributes"
      }
      .toList()
      .sortedByDescending { it.absolutePath.length }
      .forEach { candidate ->
        if (candidate.isDirectory) {
          candidate.deleteRecursively()
        } else {
          candidate.delete()
        }
      }
  }
}

tasks.register("verifyMlcAndroidDist") {
  group = "mlc"
  description = "Verify that dist/lib/mlc4j contains the Android runtime artifacts required by the app."

  doLast {
    val requiredOutputs =
      listOf(
        "dist/lib/mlc4j/build.gradle",
        "dist/lib/mlc4j/output/arm64-v8a/libtvm4j_runtime_packed.so",
        "dist/lib/mlc4j/output/tvm4j_core.jar",
        "dist/lib/mlc4j/src/main/assets/mlc-app-config.json",
      )

    val missingOutputs =
      requiredOutputs.filterNot { relativePath ->
        layout.projectDirectory.file(relativePath).asFile.exists()
      }

    if (missingOutputs.isNotEmpty()) {
      error(
        "MLC packaging completed but required outputs are missing:\n" +
          missingOutputs.joinToString(separator = "\n") { "- $it" },
      )
    }
  }
}

tasks.register("prepareMlcAndroid") {
  group = "mlc"
  description = "Package and verify the Android mlc4j runtime artifacts."
  dependsOn("normalizeMlcAndroidDist", "sanitizeMlcBundleMetadata", "verifyMlcAndroidDist")
}

tasks.named("verifyMlcAndroidDist") {
  mustRunAfter("normalizeMlcAndroidDist")
}

tasks.named("sanitizeMlcBundleMetadata") {
  mustRunAfter("normalizeMlcAndroidDist")
}


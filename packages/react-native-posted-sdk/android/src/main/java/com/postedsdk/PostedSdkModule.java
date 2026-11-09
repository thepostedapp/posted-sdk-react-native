package com.postedsdk;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.util.HashMap;
import java.util.Map;

public class PostedSdkModule extends ReactContextBaseJavaModule {
  PostedSdkModule(ReactApplicationContext context) {
    super(context);
  }

  @NonNull
  @Override
  public String getName() {
    return "PostedSdk";
  }

  @Override
  public Map<String, Object> getConstants() {
    Map<String, Object> constants = new HashMap<>();
    String installSource = installSource();
    if (installSource != null) constants.put("installSource", installSource);
    return constants;
  }

  @Nullable
  private String installSource() {
    Context context = getReactApplicationContext();
    if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      return "development";
    }
    String installer;
    try {
      PackageManager packageManager = context.getPackageManager();
      String packageName = context.getPackageName();
      installer = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
          ? packageManager.getInstallSourceInfo(packageName).getInstallingPackageName()
          : packageManager.getInstallerPackageName(packageName);
    } catch (Exception e) {
      return null;
    }
    return "com.android.vending".equals(installer) ? "store" : "development";
  }
}

# Keep Room's generated database implementations. androidx.work (pulled in
# by the Google Mobile Ads SDK) instantiates WorkDatabase_Impl by name, and
# R8 otherwise strips it in release builds, which crashes the app at launch.
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**

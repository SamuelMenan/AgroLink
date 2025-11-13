package com.agrolink.patterns.singleton;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Singleton holding an in-memory profanity dictionary.
 * Lazy-loaded, thread-safe using initialization-on-demand holder idiom.
 */
public final class ProfanityDictionary {
  private final Set<String> words = new HashSet<>();

  private ProfanityDictionary(){
    // default seed list
    Collections.addAll(words, "malo", "feo", "grosero");
  }

  private static class Holder { private static final ProfanityDictionary INSTANCE = new ProfanityDictionary(); }

  public static ProfanityDictionary get(){ return Holder.INSTANCE; }

  public boolean contains(String token){ return words.contains(token.toLowerCase()); }

  public String moderate(String text){
    if (text == null) return "";
    String[] parts = text.split("\\s+");
    for (int i=0;i<parts.length;i++){
      if (contains(parts[i])) parts[i] = "***";
    }
    return String.join(" ", parts);
  }

  public void addWord(String w){ words.add(w.toLowerCase()); }
}

package com.agrolink.patterns.templatemethod;

import com.agrolink.patterns.singleton.ProfanityDictionary;

/** Template Method pattern for moderation pipeline. */
public abstract class ModerationPipeline {
  public final String process(String raw){
    String t = normalize(raw);
    if(!lengthOk(t)) throw new IllegalArgumentException("Comentario fuera de rango");
    t = replaceProfanity(t);
    t = customStep(t);
    return t;
  }
  protected String normalize(String s){ return s == null ? "" : s.trim().replaceAll("\\s+"," "); }
  protected boolean lengthOk(String s){ return s.length() >= 10 && s.length() <= 300; }
  protected String replaceProfanity(String s){ return ProfanityDictionary.get().moderate(s); }
  protected abstract String customStep(String s);
}

class BasicModerationPipeline extends ModerationPipeline {
  protected String customStep(String s){ return s; }
}
class EmphasisPipeline extends ModerationPipeline {
  protected String customStep(String s){ return s + " #moderated"; }
}

package com.agrolink.patterns.factorymethod;

import java.util.Locale;

/** Factory Method generating moderation rule objects based on a type string. */
public class ModerationRuleFactory {
  public static ModerationRule create(String type){
    return switch(type.toLowerCase(Locale.ROOT)) {
      case "length" -> new LengthRule();
      case "stars" -> new StarsRule();
      default -> new NoopRule();
    };
  }
}

interface ModerationRule { String apply(String text); }
class LengthRule implements ModerationRule {
  public String apply(String text){ return text == null ? "" : text.trim(); }
}
class StarsRule implements ModerationRule {
  public String apply(String text){ return text.replace("*****", "***"); }
}
class NoopRule implements ModerationRule {
  public String apply(String text){ return text; }
}

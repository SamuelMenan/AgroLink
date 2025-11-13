package com.agrolink.patterns.builder;

/** Builder + Prototype example for constructing a review draft before persistence. */
public class ReviewDraft implements Cloneable {
  private String productId;
  private String buyerId;
  private int rating;
  private String comment;

  private ReviewDraft() {}

  public static Builder builder(){ return new Builder(); }

  public static class Builder {
    private final ReviewDraft draft = new ReviewDraft();
    public Builder productId(String v){ draft.productId = v; return this; }
    public Builder buyerId(String v){ draft.buyerId = v; return this; }
    public Builder rating(int v){ draft.rating = v; return this; }
    public Builder comment(String v){ draft.comment = v; return this; }
    public ReviewDraft build(){ return draft; }
  }

  @Override
  public ReviewDraft clone() {
    try { return (ReviewDraft) super.clone(); } catch (CloneNotSupportedException e) { throw new AssertionError(e); }
  }

  public String productId(){ return productId; }
  public String buyerId(){ return buyerId; }
  public int rating(){ return rating; }
  public String comment(){ return comment; }
}

package com.agrolink.reviews;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import com.agrolink.patterns.facade.ReviewFacade;
import com.agrolink.patterns.builder.ReviewDraft;
import com.agrolink.patterns.singleton.ProfanityDictionary;

@Validated
@RestController
@RequestMapping("/api")
public class ReviewController {

  private final ReviewFacade facade = new ReviewFacade(); // in real app use @Service injection

  @PostMapping("/reviews")
  public ResponseEntity<ReviewDto> create(@RequestBody CreateReviewRequest req) {
    // Builder + Prototype usage: start a draft, clone if needed (example)
    ReviewDraft draft = ReviewDraft.builder()
        .productId(req.getProductId())
        .buyerId("me") // replace with auth
        .rating(req.getRating())
        .comment(req.getComment())
        .build();
    ReviewDraft workingCopy = draft.clone(); // prototype clone
    // Facade coordinates moderation & persistence
    var result = facade.createReview(workingCopy);
    ReviewDto dto = new ReviewDto();
    dto.setId(result.id());
    dto.setProductId(result.productId());
    dto.setBuyerId(result.buyerId());
    dto.setRating(result.rating());
    dto.setComment(result.moderatedComment());
    dto.setCreatedAt(result.createdAt().toString());
    return ResponseEntity.ok(dto);
  }

  @GetMapping("/products/{productId}/reviews")
  public ResponseEntity<List<ReviewDto>> listByProduct(@PathVariable String productId) {
    // TODO: fetch from DB
    return ResponseEntity.ok(List.of());
  }

  @GetMapping("/products/{productId}/rating-summary")
  public ResponseEntity<RatingSummary> summary(@PathVariable String productId) {
    var summary = facade.getSummary(productId);
    return ResponseEntity.ok(new RatingSummary(productId, summary.average(), summary.count()));
  }

  public static class CreateReviewRequest {
    @NotBlank
    private String productId;
    @Min(1) @Max(5)
    private int rating;
    @NotBlank @Size(min = 10, max = 300)
    private String comment;

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
  }

  public static class ReviewDto {
    private String id;
    private String productId;
    private String buyerId;
    private int rating;
    private String comment;
    private String createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getBuyerId() { return buyerId; }
    public void setBuyerId(String buyerId) { this.buyerId = buyerId; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
  }

  public static class RatingSummary {
    private String productId;
    private double average;
    private int count;

    public RatingSummary(String productId, double average, int count) {
      this.productId = productId; this.average = average; this.count = count;
    }
    public String getProductId() { return productId; }
    public double getAverage() { return average; }
    public int getCount() { return count; }
  }
}

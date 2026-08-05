package dev.billisan.global.paging;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * {@code PageRequest.of(page, size)}는 offset을 {@code page*size}로 계산해서, 매 호출마다
 * size가 달라질 수 있는 커서 페이지네이션과 안 맞는다(offset이 size의 배수가 아니면 엉뚱한
 * 위치를 조회함 — {@code InspectionAdminService}에서 리뷰로 발견된 것과 같은 문제). offset을
 * 그대로 쓰는 Pageable을 직접 구현해 우회한다.
 */
public record OffsetPageRequest(int offset, int limit) implements Pageable {

    @Override
    public int getPageNumber() {
        return limit == 0 ? 0 : offset / limit;
    }

    @Override
    public int getPageSize() {
        return limit;
    }

    @Override
    public long getOffset() {
        return offset;
    }

    @Override
    public Sort getSort() {
        return Sort.unsorted();
    }

    @Override
    public Pageable next() {
        return new OffsetPageRequest(offset + limit, limit);
    }

    @Override
    public Pageable previousOrFirst() {
        return hasPrevious() ? new OffsetPageRequest(offset - limit, limit) : first();
    }

    @Override
    public Pageable first() {
        return new OffsetPageRequest(0, limit);
    }

    @Override
    public Pageable withPage(int pageNumber) {
        return new OffsetPageRequest(pageNumber * limit, limit);
    }

    @Override
    public boolean hasPrevious() {
        return offset > 0;
    }
}

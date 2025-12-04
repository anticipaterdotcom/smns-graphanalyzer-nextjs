"""
Tests for Graph Analyzer - using real sample data TEST_TCA3_2016_terr-0 (1).csv
"""
import pytest
import numpy as np
import pandas as pd
from pathlib import Path

from analyzer import GraphAnalyzer, Extremum


TEST_DATA_PATH = Path(__file__).parent / "test_data.csv"


@pytest.fixture
def sample_data():
    df = pd.read_csv(TEST_DATA_PATH, delimiter=';', header=None)
    return df.values


@pytest.fixture
def analyzer(sample_data):
    ga = GraphAnalyzer(frequency=100.0)
    ga.load_csv(sample_data, add_padding=True)
    return ga


class TestDataLoading:
    def test_load_csv_shape(self, analyzer, sample_data):
        original_rows, original_cols = sample_data.shape
        assert analyzer.raw_data.shape[0] == original_rows + 200
        assert analyzer.raw_data.shape[1] == original_cols

    def test_load_csv_padding(self, analyzer):
        assert np.all(analyzer.raw_data[:100, :] == 0)
        assert np.all(analyzer.raw_data[-100:, :] == 0)

    def test_load_csv_data_preserved(self, analyzer, sample_data):
        loaded_data = analyzer.raw_data[100:-100, :]
        np.testing.assert_array_almost_equal(loaded_data, sample_data)


class TestExtremaDetection:
    def test_find_extrema_returns_list(self, analyzer):
        extrema = analyzer.find_extrema(column=0, min_distance=10)
        assert isinstance(extrema, list)
        assert len(extrema) > 0

    def test_find_extrema_types(self, analyzer):
        extrema = analyzer.find_extrema(column=0, min_distance=10)
        types = [e.extremum_type for e in extrema]
        assert 0 in types  # minima
        assert 1 in types  # maxima

    def test_find_extrema_sorted_by_index(self, analyzer):
        extrema = analyzer.find_extrema(column=0, min_distance=10)
        indices = [e.index for e in extrema]
        assert indices == sorted(indices)

    def test_find_extrema_min_distance(self, analyzer):
        min_distance = 20
        extrema = analyzer.find_extrema(column=0, min_distance=min_distance)
        maxima_indices = [e.index for e in extrema if e.extremum_type == 1]
        minima_indices = [e.index for e in extrema if e.extremum_type == 0]
        for indices in [maxima_indices, minima_indices]:
            for i in range(len(indices) - 1):
                assert indices[i+1] - indices[i] >= min_distance

    def test_find_extrema_values_match_data(self, analyzer):
        extrema = analyzer.find_extrema(column=0, min_distance=10)
        for ext in extrema:
            expected_value = analyzer.raw_data[ext.index, 0]
            assert ext.value == expected_value


class TestExtremaManipulation:
    def test_add_extremum_max(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        initial_count = len(analyzer.extrema)
        new_ext = analyzer.add_extremum(index=800, epsilon=20, extremum_type='max')
        assert len(analyzer.extrema) >= initial_count
        assert new_ext.extremum_type == 1

    def test_add_extremum_min(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        initial_count = len(analyzer.extrema)
        new_ext = analyzer.add_extremum(index=800, epsilon=20, extremum_type='min')
        assert len(analyzer.extrema) >= initial_count
        assert new_ext.extremum_type == 0

    def test_remove_extremum(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        initial_count = len(analyzer.extrema)
        first_index = analyzer.extrema[0].index
        result = analyzer.remove_extremum(first_index, tolerance=15)
        assert result is True
        assert len(analyzer.extrema) == initial_count - 1

    def test_remove_extremum_not_found(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        result = analyzer.remove_extremum(index=99999, tolerance=5)
        assert result is False


class TestPatternDetection:
    def test_find_pattern_low_high_low(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((0, 1, 0))
        assert isinstance(events, list)

    def test_find_pattern_high_low_high(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((1, 0, 1))
        assert isinstance(events, list)

    def test_pattern_event_structure(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((0, 1, 0))
        if events:
            event = events[0]
            required_keys = [
                'start_value', 'start_time', 'inflexion_value', 'inflexion_time',
                'end_value', 'end_time', 'shift_start_to_inflexion',
                'shift_inflexion_to_end', 'time_start_to_inflexion',
                'time_inflexion_to_end', 'cycle_time', 'pattern',
                'start_index', 'end_index'
            ]
            for key in required_keys:
                assert key in event

    def test_pattern_cycle_time_positive(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((0, 1, 0))
        for event in events:
            assert event['cycle_time'] > 0


class TestCalculations:
    def test_normalize_data(self, analyzer):
        normalized = analyzer.normalize_data(column=0)
        non_zero = np.where(analyzer.raw_data[:, 0] != 0)[0]
        if len(non_zero) > 0:
            assert normalized[non_zero[0]] == 0.0
        assert len(normalized) == analyzer.raw_data.shape[0]

    def test_calculate_distance(self, analyzer):
        distances = analyzer.calculate_distance([0], [2])
        assert len(distances) == analyzer.raw_data.shape[0]
        assert np.all(distances >= 0)

    def test_calculate_angle_3points(self, analyzer):
        angles = analyzer.calculate_angle_3points([0], [2], [4])
        assert len(angles) == analyzer.raw_data.shape[0]
        assert np.all(angles >= 0)
        assert np.all(angles <= 180)

    def test_calculate_angle_4points(self, analyzer):
        angles = analyzer.calculate_angle_4points([0], [2], [2], [4])
        assert len(angles) == analyzer.raw_data.shape[0]


class TestMeanTrend:
    def test_mean_trend_calculation(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((0, 1, 0))
        if len(events) >= 2:
            mean_trend, std_trend = analyzer.calculate_mean_trend(events, column=0)
            assert len(mean_trend) > 0
            assert len(std_trend) == len(mean_trend)
            assert np.all(std_trend >= 0)

    def test_mean_trend_with_target_length(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        events = analyzer.find_pattern_events((0, 1, 0))
        if len(events) >= 2:
            target = 50
            mean_trend, std_trend = analyzer.calculate_mean_trend(events, column=0, target_length=target)
            assert len(mean_trend) == target
            assert len(std_trend) == target


class TestSerialization:
    def test_to_dict(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        result = analyzer.to_dict()
        assert 'extrema' in result
        assert 'frequency' in result
        assert 'time_per_frame' in result
        assert 'data_shape' in result

    def test_to_dict_extrema_format(self, analyzer):
        analyzer.find_extrema(column=0, min_distance=10)
        result = analyzer.to_dict()
        for ext in result['extrema']:
            assert 'value' in ext
            assert 'index' in ext
            assert 'type' in ext


class TestEdgeCases:
    def test_empty_data(self):
        ga = GraphAnalyzer()
        with pytest.raises(ValueError):
            ga.find_extrema(column=0, min_distance=10)

    def test_column_out_of_range(self, analyzer):
        with pytest.raises(IndexError):
            analyzer.find_extrema(column=999, min_distance=10)

    def test_frequency_setting(self):
        ga = GraphAnalyzer(frequency=50.0)
        assert ga.frequency == 50.0
        assert ga.time_per_frame == 0.02


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
